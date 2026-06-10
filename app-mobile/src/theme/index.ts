// Design tokens — OilTrack VE (paleta elegida: NAVY)
// Fuente: design_handoff_oiltrack_ve/README.md → Design Tokens

export const palette = {
  primary: '#0A2540',
  primary2: '#0F2E54',
  accent: '#2563EB',
  accent2: '#3B82F6',
  glow: 'rgba(37, 99, 235, 0.18)',
};

export const T = {
  // semantic
  ink: '#0A1226',
  ink2: '#1B2440',
  muted: '#5B6478',
  muted2: '#8A93A8',
  line: '#E4E8F1',
  line2: '#EFF2F8',
  bg: '#FFFFFF',
  bg2: '#F4F6FB',
  bg3: '#F8FAFD',

  // status (dashboard cues)
  ok: '#10B981',
  warn: '#F59E0B',
  danger: '#EF4444',
  oil: '#F59E0B',
};

// Familias cargadas vía @expo-google-fonts en App.tsx
export const fonts = {
  sans: 'Inter_500Medium',
  sansSemi: 'Inter_600SemiBold',
  sansBold: 'Inter_700Bold',
  display: 'SpaceGrotesk_700Bold',
  mono: 'JetBrainsMono_700Bold',
  monoMed: 'JetBrainsMono_600SemiBold',
};

export const radius = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
};

export const shadow = {
  card: {
    shadowColor: '#0A2540',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 24,
    elevation: 3,
  },
  primary: {
    shadowColor: palette.accent,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 22,
    elevation: 6,
  },
  tabbar: {
    shadowColor: '#0A2540',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
};
