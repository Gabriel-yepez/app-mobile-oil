// Primitivas de estilo — reemplazan los wrappers className de src/tw.
//
// Todo el color sale de tokens de tema ($ink, $bg, $line…), así que el mismo
// componente sirve en claro y oscuro sin ramificar.
//
// Excepción deliberada: el hero navy es oscuro en AMBOS temas, así que los
// tonos `onDark*` son blancos fijos, no tokens.
import { useLayoutEffect } from 'react';
import { ScrollView, TextInput } from 'react-native';
import { View, Text, styled } from '@tamagui/core';

/**
 * Qué se anima cuando un componente lleva `transition`.
 *
 * La lista existe por el cambio de tema. Sin ella, `transition` anima TODO lo
 * que cambie de estilo — incluidos `backgroundColor` y `borderColor` —, así que
 * al cambiar de tema los fondos lerpean durante ~220ms mientras el texto y los
 * iconos (que reciben el color como prop JS, no como token animable) cambian de
 * golpe. Eso es lo que se veía como "primero el fondo y después los botones".
 *
 * Dejando fuera los colores, el tema entra entero en un frame y las animaciones
 * que sí importan —hundir al presionar, atenuar, las barras que crecen— siguen
 * intactas. `transform` cubre `scale` y `y`, que es como Tamagui aplica el
 * `sink` y los `enterStyle`.
 */
const ANIMA = ['opacity', 'transform', 'width'];

// ────────────────────────────────────────────
// Contenedores
// ────────────────────────────────────────────
export const Box = styled(View, {
  name: 'Box',
  animateOnly: ANIMA,
});

export const Row = styled(View, {
  name: 'Row',
  animateOnly: ANIMA,
  flexDirection: 'row',
  alignItems: 'center',
});

export const Col = styled(View, {
  name: 'Col',
  animateOnly: ANIMA,
  flexDirection: 'column',
});

/** Fondo de pantalla completo. */
export const Screen = styled(View, {
  name: 'Screen',
  animateOnly: ANIMA,
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
  animateOnly: ANIMA,
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
  animateOnly: ANIMA,
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
  animateOnly: ANIMA,
  flex: 1,
  // $bg3 y no $bg: es el fondo de página de la app. Con `$bg`, cualquier
  // pantalla que pusiera el header fuera del Scroll mostraba dos azules
  // distintos con una costura entre medio — el header heredaba el $bg3 del
  // `Screen` y el cuerpo traía el $bg del Scroll.
  backgroundColor: '$bg3',
});

// ────────────────────────────────────────────
// Separador
// ────────────────────────────────────────────
export const Divider = styled(View, {
  name: 'Divider',
  animateOnly: ANIMA,
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
import { Appearance, useColorScheme as useSystemScheme } from 'react-native';
import { blur, dark as darkColors, heroGradient, light as lightColors, shadows, type AppTheme } from '../theme';
import { useThemePref } from '../store/themePref';

/**
 * El esquema efectivo: la preferencia del usuario y, si eligió "sistema", lo
 * que diga el teléfono.
 *
 * TODO lo que depende del tema pasa por acá — colores, sombras, cristal,
 * degradado, y el proveedor de Tamagui en App.tsx. Si alguno leyera
 * `useColorScheme` directo, ese pedazo de la app ignoraría la preferencia y
 * quedaría con el tema del sistema.
 */
export function useColorScheme(): 'light' | 'dark' {
  const pref = useThemePref((s) => s.pref);
  const sistema = useSystemScheme();
  if (pref !== 'system') return pref;
  return sistema === 'dark' ? 'dark' : 'light';
}

export function useAppColors(): AppTheme {
  return useColorScheme() === 'dark' ? darkColors : lightColors;
}

/** Sombras del handoff, atenuadas en oscuro. */
export function useShadows() {
  return useColorScheme() === 'dark' ? shadows.dark : shadows.light;
}

/** Material de desenfoque del cristal, según el esquema. */
export function useBlur() {
  return useColorScheme() === 'dark' ? blur.dark : blur.light;
}

/**
 * Lleva la preferencia al lado NATIVO, que es lo único que ven el teclado, los
 * `Alert` del sistema y los menús de selección de texto: esos no leen los
 * colores de Tamagui, leen el estilo de interfaz de la ventana.
 *
 * `setColorScheme('unspecified')` devuelve el control al sistema — es lo que
 * hace que "Sistema" siga siendo de verdad el ajuste del teléfono. En RN 0.86
 * el valor es ese, no `null`.
 *
 * Va en un layoutEffect y no en un effect normal para que el cambio entre en el
 * mismo commit que el repintado de la app: con `useEffect`, al volver a
 * "Sistema" se alcanza a ver un frame con el tema anterior.
 *
 * OJO: después de esto, el `useColorScheme` de React Native devuelve el valor
 * forzado, no el del teléfono. Por eso el resolutor de arriba solo lo consulta
 * en la rama 'system', que es justo cuando no hay override.
 */
export function useNativeAppearance() {
  const pref = useThemePref((s) => s.pref);
  useLayoutEffect(() => {
    Appearance.setColorScheme(pref === 'system' ? 'unspecified' : pref);
  }, [pref]);
}

/** Degradado navy de heroes y cards oscuras, según el esquema. */
export function useHeroGradient() {
  return useColorScheme() === 'dark' ? heroGradient.dark : heroGradient.light;
}

/** true cuando el sistema está en oscuro. */
export function useIsDark(): boolean {
  return useColorScheme() === 'dark';
}
