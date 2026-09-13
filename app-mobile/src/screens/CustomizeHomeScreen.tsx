// Personalizar inicio — orden y visibilidad de los widgets.
//
// Las filas tienen altura fija (ROW_H) a propósito: así el hueco destino del
// arrastre es una división, y no hay que medir y sincronizar alturas variables
// en cada frame como pasaría arrastrando las cards reales del inicio.
import React from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Switch } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { Box, Col, Row, Touchable, Txt, useAppColors } from '../ui';
import { IconBtn } from '../components/primitives';
import { Icon } from '../components/Icon';
import { WidgetId } from '../home/layout';
import { HOME_WIDGETS } from '../home/registry';
import { useHomeLayout } from '../store/homeLayout';

const ROW_H = 68;

type FilaProps = {
  id: WidgetId;
  index: number;
  total: number;
  oculto: boolean;
  /** Índice de la fila que se está arrastrando, o -1. Compartido por todas. */
  activeIndex: SharedValue<number>;
  /** Índice donde caería ahora mismo. */
  hoverIndex: SharedValue<number>;
  /** Desplazamiento vertical del dedo. */
  dragY: SharedValue<number>;
  onMove: (id: WidgetId, to: number) => void;
  onToggle: (id: WidgetId) => void;
};

function Fila({
  id, index, total, oculto, activeIndex, hoverIndex, dragY, onMove, onToggle,
}: FilaProps) {
  const c = useAppColors();
  const def = HOME_WIDGETS[id];

  // Solo el handle arrastra: si el gesto cubriera la fila entera, el switch
  // dejaría de responder.
  const pan = Gesture.Pan()
    .onStart(() => {
      activeIndex.value = index;
      hoverIndex.value = index;
      dragY.value = 0;
    })
    .onUpdate((e) => {
      dragY.value = e.translationY;
      const destino = index + Math.round(e.translationY / ROW_H);
      hoverIndex.value = Math.max(0, Math.min(total - 1, destino));
    })
    .onEnd(() => {
      if (hoverIndex.value !== index) runOnJS(onMove)(id, hoverIndex.value);
      activeIndex.value = -1;
      hoverIndex.value = -1;
      dragY.value = 0;
    });

  const style = useAnimatedStyle(() => {
    // Esta fila es la que se arrastra: sigue al dedo, por encima del resto.
    if (activeIndex.value === index) {
      return { transform: [{ translateY: dragY.value }], zIndex: 10, opacity: 0.95 };
    }
    // Nadie arrastra: todo en su lugar.
    if (activeIndex.value === -1) {
      return { transform: [{ translateY: withTiming(0, { duration: 140 }) }], zIndex: 1, opacity: 1 };
    }
    // Otra fila se arrastra: correrse para abrir el hueco.
    const desde = activeIndex.value;
    const hasta = hoverIndex.value;
    let corrimiento = 0;
    if (desde < hasta && index > desde && index <= hasta) corrimiento = -ROW_H;
    else if (desde > hasta && index >= hasta && index < desde) corrimiento = ROW_H;
    return {
      transform: [{ translateY: withTiming(corrimiento, { duration: 140 }) }],
      zIndex: 1,
      opacity: 1,
    };
  });

  return (
    <Animated.View style={[{ height: ROW_H }, style]}>
      <Row h={ROW_H} ai="center" gap="$md" px="$lg">
        {/* El área táctil del asa ocupa el alto completo de la fila: agarrar un
            icono de 22px con el dedo es incómodo. */}
        <GestureDetector gesture={pan}>
          <Box h={ROW_H} w={32} ai="center" jc="center">
            <Icon name="grip" color={c.muted2} size={22} />
          </Box>
        </GestureDetector>

        <Box h={36} w={36} ai="center" jc="center" br={10} bg="$accentSoft" opacity={oculto ? 0.4 : 1}>
          <Icon name={def.icon} color={c.accent} size={18} />
        </Box>

        <Col f={1} opacity={oculto ? 0.4 : 1}>
          <Txt font="semi" fos={14}>{def.label}</Txt>
          <Txt fos={12} tone="muted" mt={1}>{def.description}</Txt>
        </Col>

        <Box h={ROW_H} jc="center">
          <Switch
            value={!oculto}
            onValueChange={() => onToggle(id)}
            trackColor={{ false: c.line, true: c.accent }}
          />
        </Box>
      </Row>
    </Animated.View>
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

  const activeIndex = useSharedValue(-1);
  const hoverIndex = useSharedValue(-1);
  const dragY = useSharedValue(0);

  return (
    <Box f={1} bg="$bg3">
      <Row jc="space-between" ai="center" px="$xl" pb={14} pt={insets.top + 12}>
        <Row f={1} ai="center" gap="$md">
          <IconBtn
            icon={<Icon name="chevL" color={c.ink} size={22} />}
            size={40}
            onPress={() => navigation.goBack()}
          />
          <Col f={1}>
            <Txt fos={12} tone="muted" ls={1} caps>
              Inicio
            </Txt>
            <Txt font="display" fos={22} ls={-0.5}>
              Personalizar
            </Txt>
          </Col>
        </Row>
        <Touchable onPress={reset} hitSlop={8} fade>
          <Txt font="semi" fos={12} tone="accent">Restablecer</Txt>
        </Touchable>
      </Row>

      <Txt fos={13} tone="muted" px="$xl" pb="$md">
        Arrastrá desde el asa para cambiar el orden. El interruptor muestra u
        oculta el widget sin perder su lugar.
      </Txt>

      {/* Altura fija: la lista completa entra sin scroll con seis widgets, y
          mezclar scroll con arrastre vertical pelearía por el mismo gesto. */}
      <Box h={layout.order.length * ROW_H}>
        {layout.order.map((id, i) => (
          <Fila
            key={id}
            id={id}
            index={i}
            total={layout.order.length}
            oculto={layout.hidden.includes(id)}
            activeIndex={activeIndex}
            hoverIndex={hoverIndex}
            dragY={dragY}
            onMove={move}
            onToggle={toggle}
          />
        ))}
      </Box>
    </Box>
  );
}
