// Design tokens — OilTrack VE (paleta NAVY del handoff)
// Fuente: design_handoff_oiltrack_ve/README.md → Design Tokens
//
// Cada color semántico existe en dos variantes (claro/oscuro). Los componentes
// NUNCA leen estos objetos directamente: consumen los tokens de tema de Tamagui
// ($bg, $ink, $line…), que se resuelven según el esquema del sistema.

import { Platform } from 'react-native';

// ────────────────────────────────────────────
// Marca — no cambia entre temas
// ────────────────────────────────────────────
export const palette = {
  primary: '#0A2540',
  primary2: '#0F2E54',
  accent: '#2563EB',
  accent2: '#3B82F6',
  glow: 'rgba(37, 99, 235, 0.18)',
};

// ────────────────────────────────────────────
// Tema claro — valores originales del handoff
// ────────────────────────────────────────────
export const light = {
  // superficies
  bg: '#FFFFFF',
  bg2: '#F4F6FB',
  bg3: '#F8FAFD',
  surface: '#FFFFFF',

  // texto
  ink: '#0A1226',
  ink2: '#1B2440',
  muted: '#5B6478',
  muted2: '#8A93A8',

  // bordes
  line: '#E4E8F1',
  line2: '#EFF2F8',

  // marca (en claro el hero es navy sólido)
  primary: palette.primary,
  primary2: palette.primary2,
  accent: palette.accent,
  accent2: palette.accent2,

  // Relleno de los controles sólidos: botón primario, chips activos, FAB,
  // checkbox. NO es lo mismo que `primary`: en claro coinciden, pero `primary`
  // es además el color del hero, que debe seguir siendo oscuro en ambos temas.
  // Si el botón usara `primary` en oscuro quedaría navy sobre navy, invisible.
  solid: palette.primary,
  solidInk: '#FFFFFF',

  // estado
  ok: '#10B981',
  warn: '#F59E0B',
  danger: '#EF4444',
  oil: '#F59E0B',

  // fondos suaves de estado (pills)
  okSoft: '#ECFDF5',
  warnSoft: '#FFFBEB',
  dangerSoft: '#FEF2F2',
  dangerInk: '#B91C1C',
  dangerBg: '#FEE2E2',

  // acento translúcido (chips de icono)
  accentSoft: 'rgba(37, 99, 235, 0.08)',

  // ── Cristal (tab bar y superficies translúcidas) ──────────────────────
  // El velo translúcido no está aquí: lo pone el material del sistema de
  // expo-blur, ya calibrado. Estos tres son las capas decorativas que van
  // ENCIMA del desenfoque, que es lo que hace que lea como vidrio biselado y
  // no como un plástico translúcido.
  //
  // Borde de luz del canto superior.
  glassBorder: 'rgba(255, 255, 255, 0.85)',
  // Canto exterior, apenas visible: separa la pill del fondo desenfocado.
  glassEdge: 'rgba(10, 37, 64, 0.10)',
  // Brillo especular que cae de arriba hacia abajo.
  glassSheen: 'rgba(255, 255, 255, 0.5)',
  // Lente del item activo. No usa `accentSoft` porque ese está calibrado para
  // chips sobre superficie opaca: sobre cristal se lava y no se ve nada.
  glassLens: 'rgba(37, 99, 235, 0.16)',

  // scrim de modales
  scrim: 'rgba(10, 18, 38, 0.4)',
};

// ────────────────────────────────────────────
// Tema oscuro — contrapartida navy profunda.
// Mantiene la identidad técnica: el azul acento sube de luminosidad para
// conservar contraste AA sobre superficies oscuras.
// ────────────────────────────────────────────
export const dark: typeof light = {
  // superficies
  bg: '#0A1020',
  bg2: '#111A2E',
  bg3: '#070C18',
  surface: '#0E1526',

  // texto
  ink: '#F2F5FB',
  ink2: '#D7DEEC',
  muted: '#95A0B8',
  muted2: '#6B7690',

  // bordes
  line: '#1E2740',
  line2: '#182034',

  // marca — el hero sigue siendo navy, apenas más profundo
  primary: '#0C1B2E',
  primary2: '#12263F',
  accent: '#3B82F6',
  accent2: '#60A5FA',

  // En oscuro los controles sólidos pasan al azul acento: es lo único que
  // contrasta de verdad contra el fondo navy.
  solid: '#3B82F6',
  solidInk: '#FFFFFF',

  // estado — un punto más brillantes para leer sobre oscuro
  ok: '#34D399',
  warn: '#FBBF24',
  danger: '#F87171',
  oil: '#FBBF24',

  // fondos suaves de estado
  okSoft: 'rgba(52, 211, 153, 0.12)',
  warnSoft: 'rgba(251, 191, 36, 0.12)',
  dangerSoft: 'rgba(248, 113, 113, 0.12)',
  dangerInk: '#FCA5A5',
  dangerBg: 'rgba(248, 113, 113, 0.16)',

  // acento translúcido
  accentSoft: 'rgba(59, 130, 246, 0.16)',

  // ── Cristal ──
  // Mucho más tenues: sobre navy, un reflejo blanco al 85% no lee como luz,
  // lee como un borde blanco pintado.
  glassBorder: 'rgba(255, 255, 255, 0.16)',
  glassEdge: 'rgba(255, 255, 255, 0.08)',
  glassSheen: 'rgba(255, 255, 255, 0.10)',
  glassLens: 'rgba(96, 165, 250, 0.20)',

  // scrim
  scrim: 'rgba(3, 7, 18, 0.6)',
};

export type AppTheme = typeof light;

// ────────────────────────────────────────────
// Familias cargadas vía @expo-google-fonts en App.tsx
// ────────────────────────────────────────────
export const fonts = {
  sans: 'Inter_500Medium',
  sansSemi: 'Inter_600SemiBold',
  sansBold: 'Inter_700Bold',
  display: 'SpaceGrotesk_700Bold',
  mono: 'JetBrainsMono_700Bold',
  monoMed: 'JetBrainsMono_600SemiBold',
};

export const radius = { xs: 6, sm: 10, md: 14, lg: 20, xl: 28, pill: 999 };

export const spacing = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 20,
  '2xl': 24, '3xl': 32, '4xl': 40,
};

// Sombras: en oscuro se apagan casi por completo (una sombra negra sobre fondo
// oscuro no se ve; la separación la dan los bordes).
// Desenfoque del cristal. No son colores sino parámetros del material nativo
// (en iOS, un UIBlurEffect del sistema; en Android, expo-blur emula el mismo
// material), así que viven fuera de las paletas.
export const blur = {
  light: {
    // El tint se comporta distinto en cada plataforma: en iOS nombra un
    // UIBlurEffect real del sistema, mientras que en Android expo-blur lo
    // *emula* con un velo de color plano. Y su tabla traduce el material fino a
    // un gris 199 al 55%, que contra esta paleta blanca y azul se ve sucio. El
    // chrome es blanco puro y es el que pega.
    tint: Platform.OS === 'android' ? 'systemChromeMaterialLight' : 'systemThinMaterialLight',
    intensity: 70,
  },
  dark: {
    // En oscuro el criterio se invierte, así que acá no se replica el cambio:
    // el chrome oscuro es negro puro, y sobre un fondo tan profundo como bg3
    // (#070C18) la barra quedaría MÁS oscura que la pantalla — un agujero, no
    // un cristal. El gris del material fino aclara apenas, que es lo que lee
    // como superficie elevada.
    tint: 'systemThinMaterialDark',
    intensity: 60,
  },
} as const;

export const shadows = {
  light: {
    card: { shadowColor: '#0A2540', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.06, shadowRadius: 24, elevation: 3 },
    primary: { shadowColor: palette.accent, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 22, elevation: 6 },
    tabbar: { shadowColor: '#0A2540', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 10 },
  },
  dark: {
    card: { shadowColor: '#000000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 24, elevation: 3 },
    primary: { shadowColor: '#000000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.45, shadowRadius: 22, elevation: 6 },
    tabbar: { shadowColor: '#000000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.5, shadowRadius: 20, elevation: 10 },
  },
};
