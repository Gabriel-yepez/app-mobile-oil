// Superficie de cristal — un solo componente para las tres realidades:
//
//   iOS 26+   → GlassView: liquid glass nativo de verdad (refracción del fondo,
//               brillo especular propio, respuesta al toque).
//   iOS < 26  → BlurView con un material del sistema.
//   Android   → BlurView, que a diferencia de iOS necesita que le señalen QUÉ
//               desenfocar: de ahí <GlassBlurTarget> y el ref que viaja por
//               contexto hasta aquí.
//
// ─────────────────────────────────────────────────────────────────────────────
// Por qué el target envuelve CADA PANTALLA y no el navegador entero
//
// La versión obvia —un BlurTargetView alrededor de <Tab.Navigator>— cuelga el
// emulador con un SIGSEGV: el BlurView referencia el RenderNode de su target, y
// si el target lo contiene a él, el árbol de render tiene un ciclo y hwui
// recursa hasta reventar la pila (`RenderNode::prepareTreeImpl` →
// `SkiaDisplayList::prepareListAndChildren` → … cientos de cuadros).
//
// El target NUNCA puede contener al BlurView. Por eso se aplica vía
// `screenLayout` del navegador: envuelve cada escena, y el tab bar se renderiza
// como hermano del contenedor de escenas, fuera de todo target.
//
// Como cada pantalla tiene el suyo, el target activo es el de la pantalla
// enfocada — de ahí el `version`, que además resuelve el problema de abajo.
// ─────────────────────────────────────────────────────────────────────────────
//
// Dos trampas más de React Native:
//
//  1. `overflow: 'hidden'` y `shadow*` no conviven en la misma vista en iOS: el
//     recorte se come la sombra. Por eso GlassSurface solo recorta, y la sombra
//     la pone quien lo use, en un contenedor por fuera.
//
//  2. BlurView lee `blurTarget.current` al montarse y su comprobación de cambios
//     no detecta la mutación del ref (compara `prev.current` contra
//     `next.current`, que es el mismo objeto). Mutarlo no basta: hay que
//     remontarlo. De ahí el `key` sobre `version`.
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { BlurTargetView, BlurView } from 'expo-blur';
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppColors, useBlur } from '../ui';

type BlurTarget = {
  ref: React.RefObject<View | null>;
  /** 0 = todavía no hay nada que desenfocar. Cambia al cambiar de pantalla. */
  version: number;
  attach: (node: View | null) => void;
};

const BlurTargetContext = createContext<BlurTarget | null>(null);

/**
 * Publica el target compartido. Va por encima del navegador, pero no envuelve
 * nada: quien envuelve es `GlassBlurTarget`, pantalla por pantalla.
 *
 * En iOS no hace falta —el sistema desenfoca lo que haya detrás sin que nadie
 * lo señale—, así que se limita a devolver sus hijos.
 */
export function GlassBackdrop({ children }: { children: ReactNode }) {
  const ref = useRef<View | null>(null);
  const [version, setVersion] = useState(0);

  const attach = useCallback((node: View | null) => {
    if (node == null || ref.current === node) return;
    ref.current = node;
    setVersion((v) => v + 1);
  }, []);

  const value = useMemo(() => ({ ref, version, attach }), [version, attach]);

  if (Platform.OS !== 'android') return <>{children}</>;

  return <BlurTargetContext.Provider value={value}>{children}</BlurTargetContext.Provider>;
}

/**
 * Marca UNA pantalla como lo que el cristal desenfoca. Pensado para el
 * `screenLayout` del navegador; ver el comentario de cabecera para entender por
 * qué no puede ir más arriba.
 */
export function GlassBlurTarget({ children }: { children: ReactNode }) {
  const target = useContext(BlurTargetContext);
  const isFocused = useIsFocused();
  const localRef = useRef<View | null>(null);

  // Al enfocarse, esta pantalla pasa a ser el target. El efecto cubre el cambio
  // de pestaña; el onLayout cubre el primer montaje, cuando el ref todavía no
  // estaba enganchado al correr el efecto.
  useEffect(() => {
    if (isFocused) target?.attach(localRef.current);
  }, [isFocused, target]);

  if (Platform.OS !== 'android' || !target) return <>{children}</>;

  return (
    <BlurTargetView
      ref={localRef}
      style={styles.fill}
      onLayout={() => {
        if (isFocused) target.attach(localRef.current);
      }}
    >
      {children}
    </BlurTargetView>
  );
}

type GlassSurfaceProps = {
  /** Radio del cristal. Repetilo en el contenedor que lleve la sombra. */
  radius: number;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
};

export function GlassSurface({ radius, style, children }: GlassSurfaceProps) {
  const c = useAppColors();
  const b = useBlur();
  const target = useContext(BlurTargetContext);

  // iOS 26+. El cristal nativo ya trae su propio canto y su propio brillo
  // especular, así que no le superponemos nada: se duplicarían y el efecto
  // pasaría de vidrio a plástico.
  //
  // Las dos comprobaciones no son redundantes: hay betas de iOS 26 que traen el
  // diseño Liquid Glass pero no la API, y montar un GlassView ahí revienta la
  // app (expo/expo#40911).
  if (isLiquidGlassAvailable() && isGlassEffectAPIAvailable()) {
    return (
      <GlassView
        glassEffectStyle="regular"
        isInteractive
        style={[{ borderRadius: radius, overflow: 'hidden' }, style]}
      >
        {children}
      </GlassView>
    );
  }

  const version = target?.version ?? 0;
  const ready = version > 0;

  return (
    <BlurView
      key={`blur-${version}`}
      tint={b.tint}
      intensity={b.intensity}
      blurTarget={target?.ref}
      // Sin target el método nativo cae a 'none' igual, pero avisando por
      // consola. Se lo pedimos solo cuando de verdad hay algo que desenfocar.
      blurMethod={ready ? 'dimezisBlurViewSdk31Plus' : 'none'}
      style={[
        {
          borderRadius: radius,
          overflow: 'hidden',
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: c.glassEdge,
        },
        style,
      ]}
    >
      {/* Brillo especular: lo que separa el vidrio del plástico translúcido. */}
      <LinearGradient
        colors={[c.glassSheen, 'transparent']}
        style={[styles.sheen, { height: radius * 2 }]}
        pointerEvents="none"
      />
      {/* Canto superior iluminado, como si la luz entrara por arriba. */}
      <View style={[styles.topEdge, { backgroundColor: c.glassBorder }]} pointerEvents="none" />
      {children}
    </BlurView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  sheen: { position: 'absolute', top: 0, left: 0, right: 0 },
  topEdge: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
  },
});
