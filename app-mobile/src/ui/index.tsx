// Primitivas de estilo — reemplazan los wrappers className de src/tw.
//
// Todo el color sale de tokens de tema ($ink, $bg, $line…), así que el mismo
// componente sirve en claro y oscuro sin ramificar.
//
// Excepción deliberada: el hero navy es oscuro en AMBOS temas, así que los
// tonos `onDark*` son blancos fijos, no tokens.
import { ScrollView, TextInput } from 'react-native';
import { View, Text, styled } from '@tamagui/core';

// ────────────────────────────────────────────
// Contenedores
// ────────────────────────────────────────────
export const Box = styled(View, {
  name: 'Box',
});

export const Row = styled(View, {
  name: 'Row',
  flexDirection: 'row',
  alignItems: 'center',
});

export const Col = styled(View, {
  name: 'Col',
  flexDirection: 'column',
});

/** Fondo de pantalla completo. */
export const Screen = styled(View, {
  name: 'Screen',
  flex: 1,
  backgroundColor: '$bg3',
});

// ────────────────────────────────────────────
// Superficie táctil.
// Tamagui core soporta onPress/pressStyle directamente sobre View, así que no
// hace falta envolver Pressable de RN.
// ────────────────────────────────────────────
export const Touchable = styled(View, {
  name: 'Touchable',
  cursor: 'pointer',
  variants: {
    /** Atenuado al presionar — equivale al viejo `active:opacity-*`. */
    fade: {
      true: { pressStyle: { opacity: 0.85 } },
      strong: { pressStyle: { opacity: 0.7 } },
    },
    /** Hunde levemente el elemento: para tiles y botones grandes. */
    sink: {
      true: { pressStyle: { scale: 0.97 } },
    },
  } as const,
});

// ────────────────────────────────────────────
// Texto
// ────────────────────────────────────────────
export const Txt = styled(Text, {
  name: 'Txt',
  fontFamily: '$body',
  color: '$ink',

  variants: {
    font: {
      sans: { fontFamily: '$body', fontWeight: '500' },
      semi: { fontFamily: '$body', fontWeight: '600' },
      bold: { fontFamily: '$body', fontWeight: '700' },
      display: { fontFamily: '$heading', fontWeight: '700' },
      mono: { fontFamily: '$mono', fontWeight: '700' },
      monoMed: { fontFamily: '$mono', fontWeight: '600' },
    },

    tone: {
      ink: { color: '$ink' },
      ink2: { color: '$ink2' },
      muted: { color: '$muted' },
      muted2: { color: '$muted2' },
      accent: { color: '$accent' },
      primary: { color: '$primary' },
      ok: { color: '$ok' },
      warn: { color: '$warn' },
      danger: { color: '$danger' },
      dangerInk: { color: '$dangerInk' },
      white: { color: '#FFFFFF' },
      /** Sobre un control sólido ($solid). */
      onSolid: { color: '$solidInk' },
      /** Sobre el hero navy — blanco fijo en ambos temas. */
      onDark: { color: '#FFFFFF' },
      onDarkSoft: { color: 'rgba(255,255,255,0.7)' },
      onDarkMuted: { color: 'rgba(255,255,255,0.6)' },
    },

    /** Etiquetas técnicas en versalitas del handoff. */
    caps: {
      true: { textTransform: 'uppercase' },
    },
  } as const,

  defaultVariants: {
    font: 'sans',
  },
});

/**
 * Campo de texto. Tamagui puede estilar componentes de RN directamente, así que
 * heredamos el TextInput nativo en vez de reimplementarlo.
 */
// El tercer argumento marca el componente como textual: sin `isText`, Tamagui no
// reconoce props tipográficas (color, fontFamily) sobre un componente de RN.
export const NativeInput = styled(
  TextInput,
  {
    name: 'NativeInput',
    color: '$ink',
    fontFamily: '$body',
  },
  { isText: true }
);

/**
 * ScrollView con estilos de tema. Ojo: `contentContainerStyle` no pasa por
 * Tamagui, así que los paddings del contenido siguen siendo estilos de RN.
 */
export const Scroll = styled(ScrollView, {
  name: 'Scroll',
  flex: 1,
  backgroundColor: '$bg',
});

// ────────────────────────────────────────────
// Separador
// ────────────────────────────────────────────
export const Divider = styled(View, {
  name: 'Divider',
  height: 1,
  backgroundColor: '$line',
  alignSelf: 'stretch',
});

export { View as TamaguiView, Text as TamaguiText, styled };

// ────────────────────────────────────────────
// Colores resueltos para consumidores imperativos.
//
// Los componentes styled leen tokens ($ink, $line…) y Tamagui los resuelve solo.
// Pero hay props que reciben strings crudos y no pasan por Tamagui: `stroke` y
// `fill` de react-native-svg, `colors` de LinearGradient, `placeholderTextColor`.
// Para esos, este hook devuelve la paleta ya resuelta según el esquema del
// sistema. Misma fuente de verdad que los temas de Tamagui: src/theme.
import { useColorScheme } from 'react-native';
import { dark as darkColors, light as lightColors, shadows, type AppTheme } from '../theme';

export function useAppColors(): AppTheme {
  return useColorScheme() === 'dark' ? darkColors : lightColors;
}

/** Sombras del handoff, atenuadas en oscuro. */
export function useShadows() {
  return useColorScheme() === 'dark' ? shadows.dark : shadows.light;
}

/** true cuando el sistema está en oscuro. */
export function useIsDark(): boolean {
  return useColorScheme() === 'dark';
}
