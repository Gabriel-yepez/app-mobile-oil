// Set de iconos SVG stroke 1.75 — migrado 1:1 desde el handoff (src/tokens.jsx)
import React from 'react';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

export type IconName =
  | 'car'
  | 'moto'
  | 'drop'
  | 'gauge'
  | 'bell'
  | 'user'
  | 'home'
  | 'plus'
  | 'chevR'
  | 'chevL'
  | 'chevD'
  | 'check'
  | 'close'
  | 'search'
  | 'settings'
  | 'calendar'
  | 'edit'
  | 'trash'
  | 'arrow'
  | 'eye'
  | 'eyeOff'
  | 'oil'
  | 'history'
  | 'flag'
  | 'shield'
  | 'logout'
  | 'spark';

type Props = {
  name: IconName;
  color?: string;
  size?: number;
};

export function Icon({ name, color = '#0A1226', size = 24 }: Props) {
  const sw = 1.75;
  switch (name) {
    case 'car':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M3 13l2-5.5C5.4 6.5 6.4 6 7.5 6h9c1.1 0 2.1.5 2.5 1.5L21 13" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M3 13h18v4a1 1 0 0 1-1 1h-2v-2H6v2H4a1 1 0 0 1-1-1v-4z" stroke={color} strokeWidth={sw} strokeLinejoin="round" />
          <Circle cx={7.5} cy={15.5} r={1.25} fill={color} />
          <Circle cx={16.5} cy={15.5} r={1.25} fill={color} />
        </Svg>
      );
    case 'moto':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Circle cx={5} cy={17} r={3} stroke={color} strokeWidth={sw} />
          <Circle cx={19} cy={17} r={3} stroke={color} strokeWidth={sw} />
          <Path d="M5 17l3-7h4l3 4h4" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M14 6h3l1 4" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M9 10h5" stroke={color} strokeWidth={sw} strokeLinecap="round" />
        </Svg>
      );
    case 'drop':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M12 3s7 7.5 7 12a7 7 0 1 1-14 0c0-4.5 7-12 7-12z" stroke={color} strokeWidth={sw} strokeLinejoin="round" />
        </Svg>
      );
    case 'gauge':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M4 16a8 8 0 1 1 16 0" stroke={color} strokeWidth={sw} strokeLinecap="round" />
          <Path d="M12 16l4-5" stroke={color} strokeWidth={sw} strokeLinecap="round" />
          <Circle cx={12} cy={16} r={1.5} fill={color} />
        </Svg>
      );
    case 'bell':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M6 17V11a6 6 0 1 1 12 0v6l1.5 2h-15L6 17z" stroke={color} strokeWidth={sw} strokeLinejoin="round" />
          <Path d="M10 21h4" stroke={color} strokeWidth={sw} strokeLinecap="round" />
        </Svg>
      );
    case 'user':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Circle cx={12} cy={8} r={4} stroke={color} strokeWidth={sw} />
          <Path d="M4 21c0-4 4-6 8-6s8 2 8 6" stroke={color} strokeWidth={sw} strokeLinecap="round" />
        </Svg>
      );
    case 'home':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1v-9z" stroke={color} strokeWidth={sw} strokeLinejoin="round" />
        </Svg>
      );
    case 'plus':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M12 5v14M5 12h14" stroke={color} strokeWidth={2} strokeLinecap="round" />
        </Svg>
      );
    case 'chevR':
      return (
        <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
          <Path d="M7 4l6 6-6 6" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case 'chevL':
      return (
        <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
          <Path d="M13 4l-6 6 6 6" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case 'chevD':
      return (
        <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
          <Path d="M5 8l5 5 5-5" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case 'check':
      return (
        <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
          <Path d="M4 10l4 4 8-9" stroke={color} strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case 'close':
      return (
        <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
          <Path d="M5 5l10 10M15 5L5 15" stroke={color} strokeWidth={2} strokeLinecap="round" />
        </Svg>
      );
    case 'search':
      return (
        <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
          <Circle cx={9} cy={9} r={5.5} stroke={color} strokeWidth={sw} />
          <Path d="M13 13l4 4" stroke={color} strokeWidth={sw} strokeLinecap="round" />
        </Svg>
      );
    case 'settings':
      return (
        <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
          <Circle cx={10} cy={10} r={2.5} stroke={color} strokeWidth={sw} />
          <Path
            d="M10 2v2M10 16v2M2 10h2M16 10h2M4.5 4.5l1.4 1.4M14.1 14.1l1.4 1.4M4.5 15.5l1.4-1.4M14.1 5.9l1.4-1.4"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
          />
        </Svg>
      );
    case 'calendar':
      return (
        <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
          <Rect x={3} y={4} width={14} height={13} rx={2} stroke={color} strokeWidth={sw} />
          <Path d="M3 8h14M7 2v3M13 2v3" stroke={color} strokeWidth={sw} strokeLinecap="round" />
        </Svg>
      );
    case 'edit':
      return (
        <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
          <Path d="M3 17l1-4 9-9 3 3-9 9-4 1z" stroke={color} strokeWidth={sw} strokeLinejoin="round" />
        </Svg>
      );
    case 'trash':
      return (
        <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
          <Path d="M4 6h12M8 6V4h4v2M6 6v10a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V6" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case 'arrow':
      return (
        <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
          <Path d="M4 10h12M11 5l5 5-5 5" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case 'eye':
      return (
        <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
          <Path d="M2 10s3-6 8-6 8 6 8 6-3 6-8 6-8-6-8-6z" stroke={color} strokeWidth={sw} />
          <Circle cx={10} cy={10} r={2.5} stroke={color} strokeWidth={sw} />
        </Svg>
      );
    case 'eyeOff':
      return (
        <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
          <Path d="M2 10s3-6 8-6 8 6 8 6-3 6-8 6-8-6-8-6z" stroke={color} strokeWidth={sw} />
          <Path d="M4 16L16 4" stroke={color} strokeWidth={sw} strokeLinecap="round" />
        </Svg>
      );
    case 'oil':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M5 11h10v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8z" stroke={color} strokeWidth={sw} strokeLinejoin="round" />
          <Path d="M5 11l-2-3h12l2 3" stroke={color} strokeWidth={sw} strokeLinejoin="round" />
          <Path d="M15 13l5-2v5l-5-2" stroke={color} strokeWidth={sw} strokeLinejoin="round" />
          <Path d="M9 5v3M7 5h4" stroke={color} strokeWidth={sw} strokeLinecap="round" />
        </Svg>
      );
    case 'history':
      return (
        <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
          <Path d="M3 10a7 7 0 1 0 2-4.9" stroke={color} strokeWidth={sw} strokeLinecap="round" />
          <Path d="M3 3v3h3" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M10 6v4l3 2" stroke={color} strokeWidth={sw} strokeLinecap="round" />
        </Svg>
      );
    case 'flag':
      return (
        <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
          <Path d="M4 3v15M4 4h11l-2 3 2 3H4" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case 'shield':
      return (
        <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
          <Path d="M10 2l7 3v5c0 4-3 7-7 8-4-1-7-4-7-8V5l7-3z" stroke={color} strokeWidth={sw} strokeLinejoin="round" />
        </Svg>
      );
    case 'logout':
      return (
        <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
          <Path d="M9 3H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h5" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M13 6l4 4-4 4M17 10H8" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case 'spark':
      return (
        <Svg width={size} height={size} viewBox="0 0 18 18" fill="none">
          <Path d="M9 2v3M5 4l2 2M13 4l-2 2M9 7v8M9 15l-2 2M9 15l2 2" stroke={color} strokeWidth={sw} strokeLinecap="round" />
        </Svg>
      );
    default:
      return null;
  }
}

// Iconos con viewBox de 20px en el set original — para mantener proporciones del handoff
const SMALL_ICONS: IconName[] = [
  'chevR', 'chevL', 'chevD', 'check', 'close', 'search', 'settings', 'calendar',
  'edit', 'trash', 'arrow', 'eye', 'eyeOff', 'history', 'flag', 'shield', 'logout',
];

export const defaultIconSize = (name: IconName) => (SMALL_ICONS.includes(name) ? 20 : 24);
