// Onboarding — 3 slides.
//
// El gesto más reconocible de la app es el hero navy del Home: degradado
// primary→primary2 con la esquina inferior de 32. Acá ese hero se convierte en
// ESCENARIO: ocupa la mitad superior, lleva el stepper arriba y dentro actúan
// las ilustraciones. Debajo, sobre el fondo claro, el título grande y el CTA.
// Así el onboarding no inventa un lenguaje propio: usa el de la app, ampliado.
//
// Toda la animación va con el `Animated` de React Native — el mismo que usa
// OilGauge, no se mezcla otra librería. Transform y opacity salen por el driver
// nativo, así que el pager se mantiene fluido con las tres ilustraciones
// animándose a la vez.
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Easing, FlatList, ViewToken } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient as SvgGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import { Box, Col, Row, Touchable, Txt, useAppColors } from '../ui';
import { palette } from '../theme';
import { Btn } from '../components/primitives';
import { OilGauge } from '../components/OilGauge';
import { Icon } from '../components/Icon';
import { RootScreenProps } from '../navigation/types';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const COMPACT = SCREEN_H < 780;

// Caja donde actúa la ilustración dentro del escenario navy. Escala con la
// pantalla: fija, en un iPhone chico el titular terminaba pisando el CTA y en
// uno grande sobraba un hueco muerto entre el cuerpo y el botón.
const ART_BOX = Math.round(Math.max(210, Math.min(292, SCREEN_H * 0.33)));
// El viewBox del arte es 280×220; S lleva coordenadas del viewBox a píxeles,
// que es como se colocan las piezas sueltas (ruedas, badges) fuera del <Svg>.
const ART_W = Math.min(292, SCREEN_W * 0.8);
const ART_H = (ART_W * 220) / 280;
const S = ART_W / 280;
// Alto del bloque del stepper: contador + barras + aire.
const HEADER_H = 46;
const TITLE = COMPACT ? 32 : 38;

// ────────────────────────────────────────────
// Motores de animación
// ────────────────────────────────────────────

/** Vaivén 0→1→0 infinito: flotar, respirar, pulsar. */
function useOscillator(duration: number, delay = 0) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(v, { toValue: 1, duration, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [duration, delay, v]);
  return v;
}

/** Giro continuo, ya interpolado a grados para `transform: rotate`. */
function useSpin(duration: number, reverse = false) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.timing(v, { toValue: 1, duration, easing: Easing.linear, useNativeDriver: true }),
    );
    anim.start();
    return () => anim.stop();
  }, [duration, v]);
  return v.interpolate({ inputRange: [0, 1], outputRange: reverse ? ['0deg', '-360deg'] : ['0deg', '360deg'] });
}

/**
 * Rampa 0→1 que se reinicia de golpe (ondas, marcas de la vía).
 * El `delay` escalona SOLO el arranque, no entra en el ciclo: si fuera parte
 * del loop, cada onda tendría un período distinto y se irían desfasando.
 */
function useRamp(duration: number, delay = 0, easing = Easing.linear) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let anim: Animated.CompositeAnimation | undefined;
    const t = setTimeout(() => {
      anim = Animated.loop(Animated.timing(v, { toValue: 1, duration, easing, useNativeDriver: true }));
      anim.start();
    }, delay);
    return () => {
      clearTimeout(t);
      anim?.stop();
    };
  }, [duration, delay, easing, v]);
  return v;
}

/** Capa cuadrada centrada sobre la caja del arte (halos, anillos, ondas). */
function Layer({
  size,
  style,
  children,
}: {
  size: number;
  style?: Animated.WithAnimatedValue<object>;
  children: React.ReactNode;
}) {
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          left: (ART_W - size) / 2,
          top: (ART_BOX - size) / 2,
          width: size,
          height: size,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
}

/** Resplandor de acento detrás del arte: da atmósfera sobre el navy. */
function Glow({ id }: { id: string }) {
  const size = ART_W * 1.2;
  return (
    <Layer size={size}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={palette.accent2} stopOpacity={0.38} />
            <Stop offset="0.6" stopColor={palette.accent2} stopOpacity={0.08} />
            <Stop offset="1" stopColor={palette.accent2} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={50} cy={50} r={50} fill={`url(#${id})`} />
      </Svg>
    </Layer>
  );
}

// ────────────────────────────────────────────
// Ilustración 1 — el garaje: el carro rueda
// ────────────────────────────────────────────
function ArtGarage() {
  const wheel = useSpin(1300);
  const ring = useSpin(30000);
  const arc = useSpin(16000, true);
  const drop = useOscillator(1000);
  const road = useRamp(620);

  const dropScale = drop.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });
  // Guion + hueco miden 40 en coords del viewBox: al recorrer justo esa
  // distancia el ciclo es invisible y la vía parece infinita.
  const roadX = road.interpolate({ inputRange: [0, 1], outputRange: [0, -40 * S] });

  return (
    <Box width={ART_W} height={ART_BOX} ai="center" jc="center">
      <Glow id="glowGarage" />

      <Layer size={ART_W} style={{ transform: [{ rotate: ring }] }}>
        <Svg width={ART_W} height={ART_W} viewBox="0 0 280 280">
          <Circle cx={140} cy={140} r={126} fill="none" stroke="#FFFFFF" strokeOpacity={0.2} strokeWidth={1.5} strokeDasharray="2 12" />
        </Svg>
      </Layer>
      <Layer size={ART_W * 0.82} style={{ transform: [{ rotate: arc }] }}>
        <Svg width={ART_W * 0.82} height={ART_W * 0.82} viewBox="0 0 280 280">
          <Circle
            cx={140}
            cy={140}
            r={132}
            fill="none"
            stroke={palette.accent2}
            strokeOpacity={0.55}
            strokeWidth={2.5}
            strokeDasharray="30 100"
            strokeLinecap="round"
          />
        </Svg>
      </Layer>

      {/* El carro y sus piezas sueltas comparten este marco de 280×220. */}
      <Box width={ART_W} height={ART_H}>
        <Svg width={ART_W} height={ART_H} viewBox="0 0 280 220">
          <Defs>
            <SvgGradient id="carBody" x1="0" x2="0" y1="0" y2="1">
              <Stop offset="0" stopColor="#FFFFFF" />
              <Stop offset="1" stopColor="#CFDCF0" />
            </SvgGradient>
          </Defs>
          {/* sombra de contacto */}
          <Rect x={62} y={176} width={156} height={7} rx={3.5} fill="#000000" opacity={0.18} />
          <Path
            d="M50 150 L70 110 Q78 96 94 96 L186 96 Q202 96 210 110 L230 150 L230 168 Q230 174 224 174 L210 174 L210 162 L70 162 L70 174 L56 174 Q50 174 50 168 Z"
            fill="url(#carBody)"
          />
          {/* cristales navy: el mismo azul del hero, así el carro pertenece a la app */}
          <Path d="M86 116 L100 102 L168 102 L182 116 Z" fill={palette.primary} />
          <Path d="M134 102 L134 116" stroke="#FFFFFF" strokeOpacity={0.45} strokeWidth={1.5} />
          <Rect x={56} y={138} width={14} height={6} rx={2} fill={palette.accent2} />
          <Rect x={210} y={138} width={14} height={6} rx={2} fill="#EF4444" />
        </Svg>

        {/* marcas de la vía */}
        <Box pos="absolute" l={0} r={0} t={190 * S} h={4} ov="hidden">
          <Animated.View style={{ flexDirection: 'row', transform: [{ translateX: roadX }] }}>
            {Array.from({ length: 12 }).map((_, i) => (
              <Box key={i} w={26 * S} h={3} br={2} mr={14 * S} bg="rgba(255,255,255,0.3)" />
            ))}
          </Animated.View>
        </Box>

        {/* ruedas girando */}
        {[92, 188].map((cx) => (
          <Animated.View
            key={cx}
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: (cx - 15) * S,
              top: (166 - 15) * S,
              width: 30 * S,
              height: 30 * S,
              transform: [{ rotate: wheel }],
            }}
          >
            <Svg width={30 * S} height={30 * S} viewBox="0 0 30 30">
              <Circle cx={15} cy={15} r={13.5} fill={palette.primary} stroke="#FFFFFF" strokeOpacity={0.6} strokeWidth={2} />
              <Circle cx={15} cy={15} r={4} fill="#FFFFFF" fillOpacity={0.9} />
              <Line x1={15} y1={4} x2={15} y2={10} stroke="#FFFFFF" strokeOpacity={0.4} strokeWidth={1.5} />
              <Line x1={15} y1={20} x2={15} y2={26} stroke="#FFFFFF" strokeOpacity={0.4} strokeWidth={1.5} />
              <Line x1={4} y1={15} x2={10} y2={15} stroke="#FFFFFF" strokeOpacity={0.4} strokeWidth={1.5} />
              <Line x1={20} y1={15} x2={26} y2={15} stroke="#FFFFFF" strokeOpacity={0.4} strokeWidth={1.5} />
            </Svg>
          </Animated.View>
        ))}

        {/* badge de gota, latiendo */}
        <Animated.View
          pointerEvents="none"
          style={{ position: 'absolute', left: 196 * S, top: 24 * S, transform: [{ scale: dropScale }] }}
        >
          <Svg width={52 * S} height={52 * S} viewBox="0 0 52 52">
            <Circle cx={26} cy={26} r={24} fill="#FFFFFF" />
            <Circle cx={26} cy={26} r={24} fill="none" stroke={palette.accent} strokeOpacity={0.25} strokeWidth={2} />
            <Path d="M26 12 C 34 24, 37 30, 26 38 C 15 30, 18 24, 26 12 Z" fill={palette.accent} />
          </Svg>
        </Animated.View>
      </Box>
    </Box>
  );
}

// ────────────────────────────────────────────
// Ilustración 2 — el aceite: el medidor del Home, en grande
// ────────────────────────────────────────────
function ArtOil({ active }: { active: boolean }) {
  const ring = useSpin(34000, true);
  const size = Math.min(236, ART_BOX - 28, ART_W);

  // OilGauge barre su arco al montar. Se remonta al volver a esta slide para
  // que el barrido se vuelva a ver y no quede un medidor estático.
  const [run, setRun] = useState(0);
  useEffect(() => {
    if (active) setRun((r) => r + 1);
  }, [active]);

  return (
    <Box width={ART_W} height={ART_BOX} ai="center" jc="center">
      <Glow id="glowOil" />
      <Layer size={size * 1.32} style={{ transform: [{ rotate: ring }] }}>
        <Svg width={size * 1.32} height={size * 1.32} viewBox="0 0 280 280">
          <Circle cx={140} cy={140} r={132} fill="none" stroke="#FFFFFF" strokeOpacity={0.18} strokeWidth={1.5} strokeDasharray="2 14" />
          <Circle
            cx={140}
            cy={140}
            r={132}
            fill="none"
            stroke={palette.accent2}
            strokeOpacity={0.5}
            strokeWidth={2.5}
            strokeDasharray="36 300"
            strokeLinecap="round"
          />
        </Svg>
      </Layer>
      <OilGauge key={run} pct={72} kmLeft={1840} size={size} />
    </Box>
  );
}

// ────────────────────────────────────────────
// Ilustración 3 — las alertas: llega el aviso
// ────────────────────────────────────────────
function Ripple({ delay, cx, cy }: { delay: number; cx: number; cy: number }) {
  const v = useRamp(2400, delay, Easing.out(Easing.quad));
  const size = 104 * S;
  const scale = v.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1.9] });
  const opacity = v.interpolate({ inputRange: [0, 0.12, 1], outputRange: [0, 0.5, 0] });
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: cx - size / 2,
        top: cy - size / 2,
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 2,
        borderColor: palette.accent2,
        transform: [{ scale }],
        opacity,
      }}
    />
  );
}

function ArtAlerts() {
  const c = useAppColors();
  const bell = useRef(new Animated.Value(0)).current;
  const card = useRef(new Animated.Value(0)).current;

  // Campana: dos sacudidas y descanso, en bucle.
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.delay(900),
        Animated.timing(bell, { toValue: 1, duration: 110, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(bell, { toValue: -1, duration: 140, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(bell, { toValue: 0.6, duration: 130, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(bell, { toValue: 0, duration: 160, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.delay(1400),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [bell]);

  // Tarjeta de aviso: entra desde la derecha, se queda y sale.
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.delay(500),
        Animated.timing(card, { toValue: 1, duration: 520, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.delay(1900),
        Animated.timing(card, { toValue: 0, duration: 320, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
        Animated.delay(300),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [card]);

  const bellRotate = bell.interpolate({ inputRange: [-1, 1], outputRange: ['-14deg', '14deg'] });
  const cardX = card.interpolate({ inputRange: [0, 1], outputRange: [46, 0] });
  const cardScale = card.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] });

  // Centro de la campana, en coords del viewBox → píxeles.
  const bellX = 200 * S;
  const bellY = 58 * S;

  return (
    <Box width={ART_W} height={ART_BOX} ai="center" jc="center">
      <Glow id="glowAlerts" />

      <Box width={ART_W} height={ART_H}>
        {[0, 800, 1600].map((d) => (
          <Ripple key={d} delay={d} cx={bellX} cy={bellY} />
        ))}

        {/* teléfono */}
        <Svg width={ART_W} height={ART_H} viewBox="0 0 280 220">
          <Rect x={102} y={26} width={76} height={168} rx={16} fill={palette.primary} stroke="#FFFFFF" strokeOpacity={0.35} strokeWidth={2} />
          <Rect x={108} y={38} width={64} height={144} rx={10} fill="#FFFFFF" />
          <Rect x={108} y={38} width={64} height={22} rx={10} fill={palette.primary} />
          <Rect x={108} y={50} width={64} height={10} fill={palette.primary} />
          <Rect x={116} y={72} width={48} height={5} rx={2.5} fill="#CFD6E4" />
          <Rect x={116} y={84} width={32} height={5} rx={2.5} fill="#E4E8F1" />
          <Rect x={116} y={110} width={48} height={5} rx={2.5} fill="#CFD6E4" />
          <Rect x={116} y={122} width={38} height={5} rx={2.5} fill="#E4E8F1" />
          <Rect x={116} y={148} width={48} height={5} rx={2.5} fill="#CFD6E4" />
          <Rect x={116} y={160} width={26} height={5} rx={2.5} fill="#E4E8F1" />
        </Svg>

        {/* aviso que aterriza sobre la pantalla */}
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 30 * S,
            top: 96 * S,
            width: 216 * S,
            opacity: card,
            transform: [{ translateX: cardX }, { scale: cardScale }],
          }}
        >
          <Row
            gap={10}
            ai="center"
            br="$md"
            p={10}
            bg="#FFFFFF"
            style={{ shadowColor: '#00060F', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 18, elevation: 8 }}
          >
            {/* La tarjeta es blanca en ambos temas, así que sus tintes son
                fijos: los tokens de tema acá la volverían ilegible en oscuro. */}
            <Box h={34} w={34} br={10} ai="center" jc="center" bg="#FFF4DB">
              <Icon name="bell" color="#B45309" size={18} />
            </Box>
            <Col f={1} gap={6}>
              <Box h={7} w="76%" br={4} bg="#0A1226" opacity={0.85} />
              <Box h={6} w="48%" br={3} bg="#8A93A8" />
            </Col>
          </Row>
        </Animated.View>

        {/* campana */}
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: bellX - 26 * S,
            top: bellY - 26 * S,
            transform: [{ rotate: bellRotate }],
          }}
        >
          <Box
            h={52 * S}
            w={52 * S}
            br={999}
            ai="center"
            jc="center"
            bg={c.warn}
            style={{ shadowColor: c.warn, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.5, shadowRadius: 14, elevation: 6 }}
          >
            <Icon name="bell" color="#FFFFFF" size={Math.round(26 * S)} />
          </Box>
        </Animated.View>
      </Box>
    </Box>
  );
}

// ────────────────────────────────────────────
// Contenido
// ────────────────────────────────────────────
type Slide = {
  key: string;
  eyebrow: string;
  title: string;
  /** Cierre del título en azul acento: es lo que le da carácter al titular. */
  titleAccent: string;
  body: string;
};

const SLIDES: Slide[] = [
  {
    key: 'garage',
    eyebrow: 'Tu garaje',
    title: 'Todos tus vehículos,\n',
    titleAccent: 'en orden.',
    body: 'Registra carros y motos con marca, modelo, año y kilometraje. Cada uno con su historia al día.',
  },
  {
    key: 'oil',
    eyebrow: 'Control de aceite',
    title: 'El próximo cambio,\n',
    titleAccent: 'al kilómetro.',
    body: 'Llevamos la cuenta del kilometraje real y te decimos exactamente cuánto le queda al aceite.',
  },
  {
    key: 'alerts',
    eyebrow: 'Alertas a tiempo',
    title: 'Te avisamos antes\n',
    titleAccent: 'que el motor.',
    body: 'Alertas tempranas según el kilometraje de cada vehículo y el tipo de aceite que usas en Venezuela.',
  },
];

function renderArt(key: string, active: boolean) {
  if (key === 'garage') return <ArtGarage />;
  if (key === 'oil') return <ArtOil active={active} />;
  return <ArtAlerts />;
}

// ────────────────────────────────────────────
// Pantalla
// ────────────────────────────────────────────
export function OnboardingScreen({ navigation }: RootScreenProps<'Onboarding'>) {
  const insets = useSafeAreaInsets();
  const c = useAppColors();
  const listRef = useRef<FlatList<Slide>>(null);
  const [index, setIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;

  const artTop = insets.top + HEADER_H + (COMPACT ? 16 : 24);
  const stageH = artTop + ART_BOX + (COMPACT ? 18 : 26);

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems[0]?.index != null) setIndex(viewableItems[0].index);
  }).current;

  const skip = () => navigation.replace('Login');

  const next = () => {
    if (index < SLIDES.length - 1) {
      listRef.current?.scrollToIndex({ index: index + 1, animated: true });
    } else {
      navigation.replace('Login');
    }
  };

  return (
    <Box f={1} bg="$bg3">
      {/* El escenario navy no se mueve: las slides pasan por delante. */}
      <StatusBar style="light" />
      <LinearGradient
        colors={[c.primary, c.primary2]}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: stageH,
          borderBottomLeftRadius: 32,
          borderBottomRightRadius: 32,
          overflow: 'hidden',
        }}
      />

      <Animated.FlatList
        ref={listRef as never}
        data={SLIDES}
        keyExtractor={(s: Slide) => s.key}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        style={{ flex: 1 }}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: true })}
        renderItem={({ item, index: i }: { item: Slide; index: number }) => {
          // Arte y texto se mueven a velocidades distintas: el arte arrastra
          // más y escala, el texto apenas se retrasa. Eso da profundidad al
          // deslizar en vez de un carrusel plano.
          const range = [(i - 1) * SCREEN_W, i * SCREEN_W, (i + 1) * SCREEN_W];
          const artX = scrollX.interpolate({ inputRange: range, outputRange: [72, 0, -72], extrapolate: 'clamp' });
          const artScale = scrollX.interpolate({ inputRange: range, outputRange: [0.82, 1, 0.82], extrapolate: 'clamp' });
          const fade = scrollX.interpolate({ inputRange: range, outputRange: [0, 1, 0], extrapolate: 'clamp' });
          const textX = scrollX.interpolate({ inputRange: range, outputRange: [36, 0, -36], extrapolate: 'clamp' });

          return (
            <Col width={SCREEN_W} f={1}>
              <Box height={ART_BOX} mt={artTop} ai="center" jc="center">
                <Animated.View style={{ opacity: fade, transform: [{ translateX: artX }, { scale: artScale }] }}>
                  {renderArt(item.key, index === i)}
                </Animated.View>
              </Box>

              <Animated.View style={{ opacity: fade, transform: [{ translateX: textX }] }}>
                <Col px={28} pt={COMPACT ? 24 : 34}>
                  <Row ai="center" gap={8} mb={12}>
                    <Box h={6} w={6} br={3} bg="$accent" />
                    <Txt font="bold" fos={11} tone="accent" ls={2} caps>
                      {item.eyebrow}
                    </Txt>
                  </Row>
                  <Txt font="display" fos={TITLE} lh={TITLE + 4} ls={-1.4}>
                    {item.title}
                    <Txt font="display" fos={TITLE} ls={-1.4} tone="accent">
                      {item.titleAccent}
                    </Txt>
                  </Txt>
                  <Txt fos={15} lh={23} tone="muted" mt="$lg">
                    {item.body}
                  </Txt>
                </Col>
              </Animated.View>
            </Col>
          );
        }}
      />

      {/* ── Stepper: fijo arriba, sobre el escenario ── */}
      <Col pos="absolute" t={insets.top + 8} l={20} r={20} gap={10}>
        <Row jc="space-between" ai="center">
          <Row ai="baseline" gap={4}>
            <Txt font="mono" fos={13} tone="onDark" ls={0.5}>
              {`0${index + 1}`}
            </Txt>
            <Txt font="monoMed" fos={13} col="rgba(255,255,255,0.45)" ls={0.5}>
              {`/ 0${SLIDES.length}`}
            </Txt>
          </Row>
          <Touchable onPress={skip} hitSlop={14} fade>
            <Txt font="semi" fos={14} tone="onDarkSoft">
              Saltar
            </Txt>
          </Touchable>
        </Row>

        <Row gap={6}>
          {SLIDES.map((s, i) => (
            <Box key={s.key} f={1} h={5} br="$pill" ov="hidden" bg="rgba(255,255,255,0.18)">
              <Box
                f={1}
                transition="lazy"
                opacity={i <= index ? 1 : 0}
                bg={i === index ? '$accent2' : 'rgba(255,255,255,0.65)'}
              />
            </Box>
          ))}
        </Row>
      </Col>

      {/* ── CTA ── */}
      <Box px={24} pt={8} pb={Math.max(insets.bottom, 24) + 8}>
        <Btn
          kind="primary"
          size="lg"
          style={{ alignSelf: 'stretch' }}
          iconRight={<Icon name="arrow" color={c.solidInk} size={20} />}
          onPress={next}
        >
          {index === SLIDES.length - 1 ? 'Empezar' : 'Continuar'}
        </Btn>
      </Box>
    </Box>
  );
}
