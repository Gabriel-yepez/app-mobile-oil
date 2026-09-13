// Medidor radial de vida del aceite — arco 270° (-225° → +45°), ticks cada 27°,
// lectura central mono 44px + status pill. Animación 800ms ease-out al montar.
import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import Svg, { Defs, LinearGradient, Line, Path, Stop } from 'react-native-svg';
import { Box, Txt, useAppColors } from '../ui';
import { palette } from '../theme';
import { fmtKm } from '../utils/format';
import { StatusPill } from './primitives';
import { VehicleStatus } from '../data/mock';

const AnimatedPath = Animated.createAnimatedComponent(Path);

type Props = {
  pct?: number;
  kmLeft?: number;
  size?: number;
};

export function OilGauge({ pct = 70, kmLeft = 1840, size = 220 }: Props) {
  const start = -225;
  const total = 270;
  const r = (size - 28) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const clamped = Math.max(0, Math.min(1, pct / 100));
  const status: VehicleStatus = pct > 40 ? 'ok' : pct > 15 ? 'warn' : 'danger';
  // El medidor vive sobre el hero navy, que es oscuro en ambos temas; aun así
  // los colores de estado salen del tema activo para no desentonar con el resto.
  const c = useAppColors();
  const statusColor = status === 'ok' ? palette.accent : status === 'warn' ? c.warn : c.danger;

  const polar = (deg: number): [number, number] => {
    const a = (deg * Math.PI) / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  };
  const arc = (from: number, to: number) => {
    const [x1, y1] = polar(from);
    const [x2, y2] = polar(to);
    const large = Math.abs(to - from) > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
  };

  // Animación del progreso con strokeDashoffset sobre el arco completo
  const arcLen = ((2 * Math.PI * r) * total) / 360;
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: clamped,
      duration: 800,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [clamped, progress]);

  const dashOffset = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [arcLen, 0],
  });

  // ticks cada 27° (10 pasos)
  const ticks = useMemo(() => {
    const out: { x1: number; y1: number; x2: number; y2: number; major: boolean }[] = [];
    for (let i = 0; i <= 10; i++) {
      const deg = start + (total * i) / 10;
      const [x1, y1] = polar(deg);
      const inner = r - (i % 5 === 0 ? 12 : 7);
      const a = (deg * Math.PI) / 180;
      out.push({
        x1,
        y1,
        x2: cx + inner * Math.cos(a),
        y2: cy + inner * Math.sin(a),
        major: i % 5 === 0,
      });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size]);

  return (
    <Box width={size} height={size}>
      <Svg width={size} height={size}>
        <Defs>
          <LinearGradient id="gaugeGrad" x1="0" x2="0" y1="0" y2="1">
            <Stop offset="0" stopColor={palette.accent2} />
            <Stop offset="1" stopColor={palette.accent} />
          </LinearGradient>
        </Defs>
        {/* track */}
        <Path d={arc(start, start + total)} stroke="rgba(255,255,255,0.12)" strokeWidth={14} fill="none" strokeLinecap="round" />
        {/* progress */}
        <AnimatedPath
          d={arc(start, start + total)}
          stroke={status === 'ok' ? 'url(#gaugeGrad)' : statusColor}
          strokeWidth={14}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${arcLen} ${arcLen}`}
          strokeDashoffset={dashOffset as unknown as number}
        />
        {/* ticks */}
        {ticks.map((t, i) => (
          <Line
            key={i}
            x1={t.x1}
            y1={t.y1}
            x2={t.x2}
            y2={t.y2}
            stroke="rgba(255,255,255,0.35)"
            strokeWidth={t.major ? 2 : 1.2}
            strokeLinecap="round"
          />
        ))}
      </Svg>

      {/* lectura central */}
      <Box pos="absolute" t={0} l={0} r={0} b={0} ai="center" jc="center">
        <Txt font="bold" fos={11} col="rgba(255,255,255,0.55)" ls={1.5} caps>
          Próximo cambio
        </Txt>
        <Txt
          font="mono"
          fos={44}
          lh={48}
          tone="onDark"
          ls={-1}
          mt={4}
          transition="gauge"
          enterStyle={{ opacity: 0, scale: 0.92 }}
        >
          {fmtKm(kmLeft)}
        </Txt>
        <Txt fos={13} col="rgba(255,255,255,0.6)" mt={2}>
          km restantes
        </Txt>
        <Box mt={10}>
          <StatusPill status={status} label={status === 'ok' ? 'AL DÍA' : status === 'warn' ? 'PRÓXIMO' : 'VENCIDO'} />
        </Box>
      </Box>
    </Box>
  );
}
