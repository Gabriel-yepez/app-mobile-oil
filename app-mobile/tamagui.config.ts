// Configuración de Tamagui — OilTrack VE
//
// Deliberadamente NO usamos @tamagui/config: sus temas por defecto pesan ~5.4MB
// en el bundle y no aportan nada, porque la app tiene su propia paleta del
// handoff. Definir tokens y temas a mano deja el costo de Tamagui en ~0.6MB.
import { createTamagui, createTokens, createFont } from '@tamagui/core';
import { createAnimations } from '@tamagui/animations-react-native';
import { dark, fonts as families, light, palette, radius, spacing } from './src/theme';

// ────────────────────────────────────────────
// Animaciones (driver RN Animated)
// ────────────────────────────────────────────
export const animations = createAnimations({
  // Entradas y transiciones de contenido
  bouncy: { type: 'spring', damping: 18, mass: 1.1, stiffness: 220 },
  // Feedback de press: corto y seco
  quick: { type: 'spring', damping: 24, mass: 0.7, stiffness: 420 },
  // Cambios de color/tema y fades
  lazy: { type: 'timing', duration: 220 },
  // Medidor y barras de progreso
  gauge: { type: 'spring', damping: 20, mass: 1, stiffness: 120 },
});

// ────────────────────────────────────────────
// Tokens estructurales (no dependen del tema)
// ────────────────────────────────────────────
export const tokens = createTokens({
  color: {
    // Solo los colores de marca fijos; lo semántico vive en los temas.
    brandPrimary: palette.primary,
    brandPrimary2: palette.primary2,
    brandAccent: palette.accent,
    brandAccent2: palette.accent2,
    white: '#FFFFFF',
    black: '#000000',
  },
  space: {
    0: 0,
    xs: spacing.xs,
    sm: spacing.sm,
    md: spacing.md,
    lg: spacing.lg,
    xl: spacing.xl,
    '2xl': spacing['2xl'],
    '3xl': spacing['3xl'],
    '4xl': spacing['4xl'],
    true: spacing.lg,
  },
  size: {
    0: 0,
    xs: spacing.xs,
    sm: spacing.sm,
    md: spacing.md,
    lg: spacing.lg,
    xl: spacing.xl,
    '2xl': spacing['2xl'],
    '3xl': spacing['3xl'],
    '4xl': spacing['4xl'],
    true: spacing.lg,
  },
  radius: {
    0: 0,
    xs: radius.xs,
    sm: radius.sm,
    md: radius.md,
    lg: radius.lg,
    xl: radius.xl,
    pill: radius.pill,
    true: radius.md,
  },
  zIndex: { 0: 0, base: 1, sticky: 100, overlay: 200, modal: 300 },
});

// ────────────────────────────────────────────
// Tipografías (cargadas con expo-font en App.tsx)
// ────────────────────────────────────────────
const sizeScale = { 1: 10, 2: 11, 3: 12, 4: 13, 5: 14, 6: 15, 7: 16, 8: 18, 9: 20, 10: 24, 11: 28, 12: 34, true: 15 };
const lineScale = { 1: 14, 2: 15, 3: 16, 4: 18, 5: 20, 6: 21, 7: 22, 8: 24, 9: 26, 10: 30, 11: 34, 12: 40, true: 21 };

const sansFont = createFont({
  family: families.sans,
  size: sizeScale,
  lineHeight: lineScale,
  weight: { 5: '500', 6: '600', 7: '700', true: '500' },
  letterSpacing: { 1: 0, true: -0.1 },
  face: {
    500: { normal: families.sans },
    600: { normal: families.sansSemi },
    700: { normal: families.sansBold },
  },
});

const displayFont = createFont({
  family: families.display,
  size: sizeScale,
  lineHeight: lineScale,
  weight: { 7: '700', true: '700' },
  letterSpacing: { true: -0.5 },
  face: { 700: { normal: families.display } },
});

const monoFont = createFont({
  family: families.mono,
  size: sizeScale,
  lineHeight: lineScale,
  weight: { 6: '600', 7: '700', true: '700' },
  letterSpacing: { true: -0.5 },
  face: {
    600: { normal: families.monoMed },
    700: { normal: families.mono },
  },
});

// ────────────────────────────────────────────
// Temas — las claves son idénticas en claro y oscuro, así que cualquier
// componente que use $ink / $bg / $line funciona en ambos sin ramificar.
// ────────────────────────────────────────────
function buildTheme(t: typeof light) {
  return {
    // alias que Tamagui espera por convención
    background: t.bg,
    color: t.ink,

    bg: t.bg,
    bg2: t.bg2,
    bg3: t.bg3,
    surface: t.surface,

    ink: t.ink,
    ink2: t.ink2,
    muted: t.muted,
    muted2: t.muted2,

    line: t.line,
    line2: t.line2,

    primary: t.primary,
    primary2: t.primary2,
    accent: t.accent,
    accent2: t.accent2,
    accentSoft: t.accentSoft,
    solid: t.solid,
    solidInk: t.solidInk,

    ok: t.ok,
    warn: t.warn,
    danger: t.danger,
    oil: t.oil,
    okSoft: t.okSoft,
    warnSoft: t.warnSoft,
    dangerSoft: t.dangerSoft,
    dangerInk: t.dangerInk,
    dangerBg: t.dangerBg,

    scrim: t.scrim,
  };
}

export const themes = {
  light: buildTheme(light),
  dark: buildTheme(dark),
};

export const config = createTamagui({
  animations,
  tokens,
  themes,
  fonts: { body: sansFont, heading: displayFont, mono: monoFont },
  defaultFont: 'body',
  shorthands: {
    bg: 'backgroundColor',
    br: 'borderRadius',
    bc: 'borderColor',
    bw: 'borderWidth',
    p: 'padding',
    px: 'paddingHorizontal',
    py: 'paddingVertical',
    pt: 'paddingTop',
    pb: 'paddingBottom',
    m: 'margin',
    mx: 'marginHorizontal',
    my: 'marginVertical',
    mt: 'marginTop',
    mb: 'marginBottom',
    ml: 'marginLeft',
    mr: 'marginRight',
    pl: 'paddingLeft',
    pr: 'paddingRight',
    ai: 'alignItems',
    jc: 'justifyContent',
    fd: 'flexDirection',
    f: 'flex',
    w: 'width',
    h: 'height',
    ta: 'textAlign',
    ff: 'fontFamily',
    fos: 'fontSize',
    lh: 'lineHeight',
    ls: 'letterSpacing',
    col: 'color',
    ov: 'overflow',
    pos: 'position',
    zi: 'zIndex',
    t: 'top',
    l: 'left',
    r: 'right',
    b: 'bottom',
    als: 'alignSelf',
    gap: 'gap',
  } as const,
  settings: {
    // `false` = sin restriccion. El handoff mezcla tokens con rgba() crudos
    // (overlays sobre el hero navy, sombras LED de las pills); con
    // 'somewhat-strict' TS rechaza todo color que no sea token, y esos casos no
    // tienen token que usar. Los valores validos son boolean | 'strict' |
    // 'somewhat-strict' | 'strict-web' | 'somewhat-strict-web' — no hay 'loose'.
    allowedStyleValues: false,
    autocompleteSpecificTokens: 'except-special',
  },
});

// createTamagui declara `animations` como `AnimationDriver<E> | AnimationsConfigObject`.
// Esa unión rompe la inferencia de Tamagui, que comprueba `extends AnimationDriver<any>`
// para sacar los nombres de animación: al no satisfacerla una unión, el prop
// `animation` queda sin valores válidos y TS rechaza `animation="bouncy"`.
// Reponemos el tipo concreto del driver antes de aumentar el módulo.
export type AppConfig = Omit<typeof config, 'animations'> & {
  animations: typeof animations;
};

// La interfaz se declara en @tamagui/web y @tamagui/core la reexporta; hay que
// aumentar AMBAS o el prop `animation` no queda tipado.
declare module '@tamagui/core' {
  interface TamaguiCustomConfig extends AppConfig {}
}

declare module '@tamagui/web' {
  interface TamaguiCustomConfig extends AppConfig {}
}

export default config;
