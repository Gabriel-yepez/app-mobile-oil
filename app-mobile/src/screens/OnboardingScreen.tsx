// Onboarding — 3 slides con pager horizontal, dots animados y CTA
import React, { useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  FlatList,
  Pressable,
  Text,
  View,
  ViewToken,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  LinearGradient,
  Path,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import { fonts, palette, T } from '../theme';
import { Btn } from '../components/primitives';
import { Icon } from '../components/Icon';
import { RootScreenProps } from '../navigation/types';

const { width: SCREEN_W } = Dimensions.get('window');

// ───────── Ilustración 1: carro + badge de gota ─────────
function IllustrationCar() {
  return (
    <Svg viewBox="0 0 280 220" width={280} height={220}>
      <Defs>
        <LinearGradient id="ill1Sky" x1="0" x2="0" y1="0" y2="1">
          <Stop offset="0" stopColor={palette.accent2} stopOpacity={0.18} />
          <Stop offset="1" stopColor={palette.accent} stopOpacity={0} />
        </LinearGradient>
        <LinearGradient id="ill1Body" x1="0" x2="0" y1="0" y2="1">
          <Stop offset="0" stopColor={palette.accent2} />
          <Stop offset="1" stopColor={palette.primary} />
        </LinearGradient>
      </Defs>
      <Circle cx={140} cy={100} r={100} fill="url(#ill1Sky)" />
      <Circle cx={140} cy={120} r={84} fill="none" stroke={palette.accent} strokeOpacity={0.18} strokeDasharray="2 6" />
      <Circle cx={140} cy={120} r={62} fill="none" stroke={palette.accent} strokeOpacity={0.12} />
      <Path
        d="M50 150 L70 110 Q78 96 94 96 L186 96 Q202 96 210 110 L230 150 L230 168 Q230 174 224 174 L210 174 L210 162 L70 162 L70 174 L56 174 Q50 174 50 168 Z"
        fill="url(#ill1Body)"
      />
      <Path d="M86 116 L100 102 L168 102 L182 116 Z" fill="#fff" fillOpacity={0.85} />
      <Path d="M134 102 L134 116" stroke={palette.primary} strokeOpacity={0.6} />
      <Rect x={56} y={138} width={14} height={6} rx={2} fill="#FFD166" />
      <Rect x={210} y={138} width={14} height={6} rx={2} fill="#EF4444" />
      <Circle cx={92} cy={166} r={14} fill="#0A1226" />
      <Circle cx={92} cy={166} r={6} fill="#fff" fillOpacity={0.4} />
      <Circle cx={188} cy={166} r={14} fill="#0A1226" />
      <Circle cx={188} cy={166} r={6} fill="#fff" fillOpacity={0.4} />
      <G x={170} y={30}>
        <Circle r={22} fill="#fff" />
        <Circle r={22} fill="none" stroke={palette.accent} strokeOpacity={0.2} />
        <Path d="M0 -12 C 8 -2, 10 4, 0 10 C -10 4, -8 -2, 0 -12 Z" fill={palette.accent} />
      </G>
    </Svg>
  );
}

// ───────── Ilustración 2: tacómetro 72% ─────────
function IllustrationGauge() {
  const ticks = Array.from({ length: 11 }).map((_, i) => {
    const a = ((-225 + (270 * i) / 10) * Math.PI) / 180;
    return {
      x1: 140 + 70 * Math.cos(a),
      y1: 110 + 70 * Math.sin(a),
      x2: 140 + 60 * Math.cos(a),
      y2: 110 + 60 * Math.sin(a),
      major: i % 5 === 0,
    };
  });
  return (
    <Svg viewBox="0 0 280 220" width={280} height={220}>
      <Defs>
        <LinearGradient id="ill2Body" x1="0" x2="1" y1="0" y2="0">
          <Stop offset="0" stopColor={palette.accent2} />
          <Stop offset="1" stopColor={palette.accent} />
        </LinearGradient>
      </Defs>
      <Circle cx={140} cy={110} r={92} fill="#fff" stroke={T.line} />
      <Circle cx={140} cy={110} r={80} fill="none" stroke={T.line2} strokeWidth={14} />
      <Path d="M 70 130 A 80 80 0 0 1 200 70" fill="none" stroke="url(#ill2Body)" strokeWidth={14} strokeLinecap="round" />
      {ticks.map((t, i) => (
        <Line
          key={i}
          x1={t.x1}
          y1={t.y1}
          x2={t.x2}
          y2={t.y2}
          stroke={palette.primary}
          strokeOpacity={0.4}
          strokeWidth={t.major ? 2 : 1}
        />
      ))}
      <G x={140} y={110} rotation={40}>
        <Circle r={8} fill={palette.primary} />
        <Path d="M 0 0 L 60 -3 L 60 3 Z" fill={palette.accent} />
        <Circle r={3} fill="#fff" />
      </G>
      <SvgText x={140} y={170} textAnchor="middle" fontFamily={fonts.mono} fontSize={14} fill={palette.primary}>
        72%
      </SvgText>
      <SvgText x={140} y={186} textAnchor="middle" fontFamily={fonts.sansBold} fontSize={9} fill={T.muted} letterSpacing={2}>
        VIDA ÚTIL
      </SvgText>
    </Svg>
  );
}

// ───────── Ilustración 3: teléfono + campana ─────────
function IllustrationBell() {
  return (
    <Svg viewBox="0 0 280 220" width={280} height={220}>
      <Defs>
        <LinearGradient id="ill3Bg" x1="0" x2="0" y1="0" y2="1">
          <Stop offset="0" stopColor={palette.accent2} stopOpacity={0.2} />
          <Stop offset="1" stopColor={palette.accent} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Circle cx={140} cy={110} r={100} fill="url(#ill3Bg)" />
      {[40, 60, 80].map((r, i) => (
        <Circle
          key={i}
          cx={140}
          cy={110}
          r={r}
          fill="none"
          stroke={palette.accent}
          strokeOpacity={0.25 - i * 0.07}
          strokeDasharray="3 4"
        />
      ))}
      <Rect x={100} y={50} width={80} height={140} rx={12} fill="#0A1226" />
      <Rect x={106} y={62} width={68} height={116} rx={6} fill="#fff" />
      <Rect x={106} y={62} width={68} height={20} fill={palette.primary} />
      <Rect x={112} y={92} width={56} height={36} rx={6} fill={palette.accent} opacity={0.1} />
      <Rect x={112} y={92} width={3} height={36} rx={1.5} fill={palette.accent} />
      <Rect x={120} y={100} width={36} height={4} rx={2} fill={palette.primary} />
      <Rect x={120} y={108} width={28} height={3} rx={1.5} fill={T.muted2} />
      <Rect x={120} y={115} width={32} height={3} rx={1.5} fill={T.muted2} />
      <G x={180} y={60}>
        <Circle r={20} fill={T.warn} />
        <Path
          d="M0 -10 C-6 -10 -8 -6 -8 -2 V 4 L-10 6 H10 L8 4 V-2 C8 -6 6 -10 0 -10 Z M-3 8 H3"
          fill="#fff"
          stroke="#fff"
          strokeWidth={0.5}
          strokeLinejoin="round"
        />
      </G>
    </Svg>
  );
}

type Slide = {
  key: string;
  illustration: React.ReactNode;
  eyebrow: string;
  title: string;
  body: string;
};

const SLIDES: Slide[] = [
  {
    key: 'a',
    illustration: <IllustrationCar />,
    eyebrow: 'Bienvenido a OilTrack VE',
    title: 'Tus vehículos, organizados como un mecánico de confianza.',
    body: 'Registra carros y motos. Marca, modelo, año y kilometraje — todo en un solo lugar.',
  },
  {
    key: 'b',
    illustration: <IllustrationGauge />,
    eyebrow: 'Control de aceite',
    title: 'Sabrás siempre cuándo y a qué kilometraje cambiar el aceite.',
    body: 'Cargá el tipo de aceite, kilometraje actual y el próximo cambio. Nosotros llevamos la cuenta por ti.',
  },
  {
    key: 'c',
    illustration: <IllustrationBell />,
    eyebrow: 'Nunca más al taller tarde',
    title: 'Te avisamos antes de que el motor lo sienta.',
    body: 'Recibe alertas a tiempo según el kilometraje real de cada vehículo, con el tipo de aceite que usas en Venezuela.',
  },
];

export function OnboardingScreen({ navigation }: RootScreenProps<'Onboarding'>) {
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<Slide>>(null);
  const [index, setIndex] = useState(0);

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems[0]?.index != null) setIndex(viewableItems[0].index);
  }).current;

  const next = () => {
    if (index < SLIDES.length - 1) {
      listRef.current?.scrollToIndex({ index: index + 1, animated: true });
    } else {
      navigation.replace('Login');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#fff', paddingTop: insets.top }}>
      {/* skip */}
      <View style={{ paddingTop: 12, paddingRight: 20, alignItems: 'flex-end' }}>
        <Pressable onPress={() => navigation.replace('Login')} hitSlop={12}>
          <Text style={{ fontFamily: fonts.sansSemi, fontSize: 14, color: T.muted }}>Saltar</Text>
        </Pressable>
      </View>

      <FlatList
        ref={listRef}
        data={SLIDES}
        keyExtractor={(s) => s.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
        renderItem={({ item }) => (
          <View style={{ width: SCREEN_W, flex: 1 }}>
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 }}>
              {item.illustration}
            </View>
            <View style={{ paddingHorizontal: 28, paddingBottom: 18 }}>
              <Text
                style={{
                  fontFamily: fonts.sansBold,
                  fontSize: 11,
                  color: palette.accent,
                  letterSpacing: 2,
                  textTransform: 'uppercase',
                  marginBottom: 10,
                }}
              >
                {item.eyebrow}
              </Text>
              <Text style={{ fontFamily: fonts.display, fontSize: 30, color: T.ink, letterSpacing: -0.8, lineHeight: 33 }}>
                {item.title}
              </Text>
              <Text style={{ marginTop: 12, fontFamily: fonts.sans, fontSize: 15, lineHeight: 22.5, color: T.muted }}>
                {item.body}
              </Text>
            </View>
          </View>
        )}
      />

      {/* dots + cta */}
      <View
        style={{
          paddingTop: 8,
          paddingHorizontal: 20,
          paddingBottom: Math.max(insets.bottom, 24) + 12,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {SLIDES.map((_, i) => (
            <Dot key={i} active={i === index} />
          ))}
        </View>
        <Btn kind="primary" icon={<Icon name="arrow" color="#fff" size={18} />} onPress={next}>
          {index === SLIDES.length - 1 ? 'Empezar' : 'Continuar'}
        </Btn>
      </View>
    </View>
  );
}

// Dot que se expande de 8×8 a 24×8 (transition width .25s)
function Dot({ active }: { active: boolean }) {
  const width = useRef(new Animated.Value(active ? 24 : 8)).current;
  React.useEffect(() => {
    Animated.timing(width, { toValue: active ? 24 : 8, duration: 250, useNativeDriver: false }).start();
  }, [active, width]);
  return (
    <Animated.View
      style={{ width, height: 8, borderRadius: 4, backgroundColor: active ? palette.primary : T.line }}
    />
  );
}
