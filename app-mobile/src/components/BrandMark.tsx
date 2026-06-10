// Marca: gota de aceite con tick de gauge interno, gradiente accent → primary
import React from 'react';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { palette } from '../theme';

type Props = { size?: number };

export function BrandMark({ size = 40 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <Defs>
        <LinearGradient id="bm" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={palette.accent} />
          <Stop offset="1" stopColor={palette.primary} />
        </LinearGradient>
      </Defs>
      <Path d="M20 4s12 13 12 20a12 12 0 1 1-24 0c0-7 12-20 12-20z" fill="url(#bm)" />
      <Path d="M14 26a6 6 0 0 0 12 0" stroke="#fff" strokeWidth={2} strokeLinecap="round" fill="none" opacity={0.9} />
      <Circle cx={20} cy={22} r={1.6} fill="#fff" />
    </Svg>
  );
}
