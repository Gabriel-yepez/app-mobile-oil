// Personalizar inicio — qué widgets se muestran y en qué orden.
//
// La pantalla lista DOS grupos, "Mostrados" y "Ocultos", y agregar u ocultar un
// widget es literalmente pasarlo de grupo. Los widgets fijos (PINNED_WIDGETS) no
// aparecen: no hay nada que decidir sobre ellos, así que listarlos solo sería
// ruido.
//
// El tablero arrastrable contiene ÚNICAMENTE a los mostrados; sus índices
// arrancan en 0 y `moveWidget` los traduce al orden completo. Por eso ocultar
// algo no pierde su lugar: los ocultos se quedan donde están en `order` y el
// widget reaparece entre los mismos vecinos.
//
// Las filas tienen altura fija (ROW_H) a propósito: así el hueco destino del
// arrastre es una división, y no hay que medir y sincronizar alturas variables
// en cada frame como pasaría arrastrando las cards reales del inicio.
//
// El orden que se DIBUJA vive en un shared value (`board`) junto al estado del
// arrastre, no en el índice que llega por props. Al soltar hay que cambiar las
// dos cosas a la vez: si se limpia el arrastre en el hilo de UI y el reorden
// llega después por React, queda un frame pintado con el orden viejo y sin
// arrastre — ese era el salto de intercambio que se veía al soltar la fila.
import React, { ReactNode } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { Box, Col, Row, Touchable, Txt, useAppColors } from '../ui';
import { IconBtn } from '../components/primitives';
import { Icon, IconName } from '../components/Icon';
import { WidgetId, isPinned } from '../home/layout';
import { HOME_WIDGETS } from '../home/registry';
import { useHomeLayout } from '../store/homeLayout';

const ROW_H = 68;

/** El hueco se abre y se cierra con resorte, que es lo que da la sensación de
 *  que las filas se corren solas. La que se suelta aterriza con una curva
 *  corta: bajo el dedo un resorte con rebote se lee como impreciso. */
const HUECO = { damping: 20, stiffness: 220, mass: 0.6 } as const;
const ATERRIZAJE = { duration: 180, easing: Easing.out(Easing.cubic) } as const;
const LEVANTE = { duration: 140 } as const;

type Board = {
  /** Orden dibujado de los widgets MOSTRADOS. Manda sobre el del store
   *  mientras dura el arrastre. */
  order: WidgetId[];
  activeId: WidgetId | null;
  /** Índice de origen y de destino del arrastre en curso; -1 si no hay. */
  from: number;
  to: number;
};

const QUIETO = { activeId: null, from: -1, to: -1 } as const;

/** El cuerpo de la fila es el mismo en los dos grupos; cambian el asa y el
 *  botón de la derecha.
 *
 *  Sin `asa` no se reserva su lugar: un hueco en blanco a la izquierda de los
 *  ocultos insinúa un agarre que no existe. El icono se corre cuando el widget
 *  pasa a "Mostrados" y el asa aparece de verdad. */
function Cuerpo({
  id,
  apagado,
  asa,
  accion,
}: {
  id: WidgetId;
  apagado?: boolean;
  asa?: ReactNode;
  accion: ReactNode;
}) {
  const c = useAppColors();
  const def = HOME_WIDGETS[id];

  return (
    <Row h={ROW_H - 12} ai="center" gap="$md" px="$md" mx="$xl" mt={6} bg="$surface" br="$md" bw={1} bc="$line">
      {asa ?? null}

      <Box h={36} w={36} ai="center" jc="center" br={10} bg="$accentSoft" opacity={apagado ? 0.45 : 1}>
        <Icon name={def.icon} color={c.accent} size={18} />
      </Box>

      <Col f={1} opacity={apagado ? 0.45 : 1}>
        <Txt font="semi" fos={14}>{def.label}</Txt>
        <Txt fos={12} tone="muted" mt={1}>{def.description}</Txt>
      </Col>

      <Box h={ROW_H - 12} jc="center" pr="$sm">
        {accion}
      </Box>
    </Row>
  );
}

/** Fila del grupo "Ocultos": sin asa (entre ocultos el orden no significa nada)
 *  y con un botón que la agrega a los mostrados. */
function FilaOculta({ id, onAdd }: { id: WidgetId; onAdd: (id: WidgetId) => void }) {
  const c = useAppColors();

  return (
    <Box h={ROW_H}>
      <Cuerpo
        id={id}
        apagado
        accion={
          <IconBtn
            icon={<Icon name="plus" color={c.accent} size={20} />}
            size={36}
            onPress={() => onAdd(id)}
          />
        }
      />
    </Box>
  );
}

type FilaProps = {
  id: WidgetId;
  board: SharedValue<Board>;
  dragY: SharedValue<number>;
  onMove: (id: WidgetId, to: number) => void;
  onHide: (id: WidgetId) => void;
};

/** Fila del grupo "Mostrados": se arrastra desde el asa y se oculta con el ojo
 *  tachado, que la manda al grupo de abajo. */
function Fila({ id, board, dragY, onMove, onHide }: FilaProps) {
  const c = useAppColors();

  const pan = Gesture.Pan()
    .onStart(() => {
      const i = board.value.order.indexOf(id);
      dragY.value = 0;
      board.value = { ...board.value, activeId: id, from: i, to: i };
    })
    .onUpdate((e) => {
      dragY.value = e.translationY;
      const b = board.value;
      const destino = b.from + Math.round(e.translationY / ROW_H);
      const to = Math.max(0, Math.min(b.order.length - 1, destino));
      if (to !== b.to) board.value = { ...b, to };
    })
    .onEnd(() => {
      const { order, from, to } = board.value;
      // Primero la fila termina de viajar hasta el hueco que ya está abierto;
      // recién cuando llegó se confirma el orden, así el commit no mueve nada.
      dragY.value = withTiming((to - from) * ROW_H, ATERRIZAJE, (llego) => {
        if (!llego) return;
        const next = [...order];
        next.splice(from, 1);
        next.splice(to, 0, id);
        // Un solo write: orden nuevo y fin del arrastre entran en el mismo
        // frame, y cada fila ya está exactamente donde la deja ese orden.
        board.value = { order: next, ...QUIETO };
        dragY.value = 0;
        if (to !== from) runOnJS(onMove)(id, to);
      });
    });

  const style = useAnimatedStyle(() => {
    const { order, activeId, from, to } = board.value;

    if (activeId === id) {
      return {
        top: from * ROW_H + dragY.value,
        transform: [{ scale: withTiming(1.02, LEVANTE) }],
        zIndex: 10,
      };
    }

    // Las demás filas ceden el lugar: la que quedó dentro del rango recorrido
    // se corre un puesto en sentido contrario al arrastre.
    let i = order.indexOf(id);
    if (activeId !== null) {
      if (from < to && i > from && i <= to) i -= 1;
      else if (from > to && i >= to && i < from) i += 1;
    }

    return {
      top: withSpring(i * ROW_H, HUECO),
      transform: [{ scale: withTiming(1, LEVANTE) }],
      zIndex: 1,
    };
  });

  return (
    <Animated.View style={[{ height: ROW_H, position: 'absolute', left: 0, right: 0 }, style]}>
      <Cuerpo
        id={id}
        asa={
          /* El área táctil del asa ocupa el alto completo de la fila: agarrar un
             icono de 22px con el dedo es incómodo. */
          <GestureDetector gesture={pan}>
            <Box h={ROW_H - 12} w={32} ai="center" jc="center">
              <Icon name="grip" color={c.muted2} size={22} />
            </Box>
          </GestureDetector>
        }
        accion={
          <IconBtn
            icon={<Icon name="eyeOff" color={c.muted} size={20} />}
            size={36}
            onPress={() => onHide(id)}
          />
        }
      />
    </Animated.View>
  );
}

/** Encabezado de grupo: el nombre con su icono y, debajo, la instrucción de
 *  qué se puede hacer con esas filas. La ayuda vive acá y no arriba de todo
 *  porque cada grupo se opera distinto. */
function Grupo({ icon, titulo, children }: { icon: IconName; titulo: string; children: ReactNode }) {
  const c = useAppColors();
  return (
    <Col px="$xl" pt="$lg" pb={2}>
      <Row ai="center" gap={6}>
        <Icon name={icon} color={c.muted} size={14} />
        <Txt font="semi" fos={11} tone="muted" caps ls={0.8}>
          {titulo}
        </Txt>
      </Row>
      <Txt fos={12} tone="muted2" mt={3}>
        {children}
      </Txt>
    </Col>
  );
}

function Vacio({ children }: { children: ReactNode }) {
  return (
    /* px + mx replican la sangría interna de las filas: el texto arranca donde
       arranca el contenido de una card, no más adentro. */
    <Txt fos={13} tone="muted2" px="$md" py="$md" mx="$xl">
      {children}
    </Txt>
  );
}

export function CustomizeHomeScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const c = useAppColors();
  const layout = useHomeLayout((s) => s.layout);
  const move = useHomeLayout((s) => s.move);
  const toggle = useHomeLayout((s) => s.toggle);
  const reset = useHomeLayout((s) => s.reset);

  // Los fijos no se listan; el resto se parte en los dos grupos de la pantalla.
  const { mostrados, ocultos } = React.useMemo(() => {
    const libres = layout.order.filter((id) => !isPinned(id));
    return {
      mostrados: libres.filter((id) => !layout.hidden.includes(id)),
      ocultos: libres.filter((id) => layout.hidden.includes(id)),
    };
  }, [layout.order, layout.hidden]);

  const board = useSharedValue<Board>({ order: mostrados, ...QUIETO });
  const dragY = useSharedValue(0);

  React.useEffect(() => {
    // El orden que viene del store (rehidratación, "Restablecer", un widget que
    // vuelve de los ocultos) manda cuando no hay arrastre. Después de soltar ya
    // coincide con el del tablero, así que este efecto no vuelve a mover nada.
    board.value = { ...board.value, order: mostrados };
  }, [board, mostrados]);

  return (
    <Box f={1} bg="$bg3">
      <Row jc="space-between" ai="center" px="$xl" pb={14} pt={insets.top + 12}>
        <Row f={1} ai="center" gap="$md">
          <IconBtn
            icon={<Icon name="chevD" color={c.ink} size={22} />}
            size={40}
            onPress={() => navigation.goBack()}
          />
          <Col f={1}>
            <Txt font="display" fos={22} ls={-0.5}>
              Personalizar
            </Txt>
          </Col>
        </Row>
        <Touchable onPress={reset} hitSlop={8} fade>
          <Txt font="semi" fos={12} tone="accent">Restablecer</Txt>
        </Touchable>
      </Row>

      <Grupo icon="eye" titulo="Mostrados">Arrastra para ordenar o toca para ocultar</Grupo>
      {mostrados.length === 0 ? (
        <Vacio>No hay widgets extra en el inicio. Agregá alguno desde abajo.</Vacio>
      ) : (
        /* Altura fija: la lista completa entra sin scroll, y mezclar scroll con
           arrastre vertical pelearía por el mismo gesto. */
        <Box h={mostrados.length * ROW_H} pos="relative">
          {mostrados.map((id) => (
            <Fila key={id} id={id} board={board} dragY={dragY} onMove={move} onHide={toggle} />
          ))}
        </Box>
      )}

      <Grupo icon="eyeOff" titulo="Ocultos">Toca para mostrar</Grupo>
      {ocultos.length === 0 ? (
        <Vacio>Ninguno: se están mostrando todos.</Vacio>
      ) : (
        <Box>
          {ocultos.map((id) => (
            <FilaOculta key={id} id={id} onAdd={toggle} />
          ))}
        </Box>
      )}
    </Box>
  );
}
