// Header fijo de las pantallas con hero azul (Perfil, Detalle de vehículo).
//
// Arriba de todo es una barra sólida que continúa el degradado del hero: se ve
// como si no existiera. Apenas empieza el scroll cruza a cristal, porque el
// contenido que pasa por debajo ya no es azul y una barra opaca ahí se lee como
// un parche.
//
// El cruce son DOS capas de fondo superpuestas con opacidad animada, y no un
// color interpolado, porque el cristal no es un color: es un material (liquid
// glass nativo en iOS 26, desenfoque en el resto) que no se puede mezclar.
//
// Los botones también cruzan, y por el mismo motivo: blancos sobre el azul,
// oscuros sobre el cristal claro. El juego oscuro es el que queda EN FLUJO —
// fija la altura y recibe los toques siempre, visible o no —; el claro va
// encima, absoluto y sin capturar toques. Como los dos ocupan exactamente el
// mismo sitio, tocar donde se ve un botón siempre pega en su gemelo.
import React from 'react';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { Box, Row, useAppColors, useBlur } from '../ui';
import { IconBtn } from './primitives';
import { Icon, IconName } from './Icon';

/** Píxeles de scroll en los que se completa el cruce. Corto a propósito: el
 *  usuario pidió que cambiara apenas empieza a hacer scroll. */
const CRUCE = 28;

/** Alto estimado mientras no se midió el real. Evita el salto del contenido en
 *  el primer frame: 12 arriba + 36 del botón + 12 abajo. */
export const estimarHeaderH = (insetTop: number) => insetTop + 60;

type Props = {
  /** Desplazamiento del scroll de la pantalla, en el hilo de UI. */
  scrollY: SharedValue<number>;
  onBack: () => void;
  /** Botón derecho. Sin `actionIcon` el header queda solo con el de volver. */
  actionIcon?: IconName;
  onAction?: () => void;
  /** Alto real de la barra, para que la pantalla separe su contenido. */
  onHeight?: (h: number) => void;
  px?: number;
};

export function StickyHeader({ scrollY, onBack, actionIcon, onAction, onHeight, px = 20 }: Props) {
  const insets = useSafeAreaInsets();
  const c = useAppColors();
  const b = useBlur();

  const azul = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, CRUCE], [1, 0], Extrapolation.CLAMP),
  }));
  const cristal = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, CRUCE], [0, 1], Extrapolation.CLAMP),
  }));

  const relleno = { paddingTop: insets.top + 12, paddingBottom: 12, paddingHorizontal: px };

  const botones = (onDark: boolean) => (
    <>
      <IconBtn
        onDark={onDark}
        icon={<Icon name="chevL" color={onDark ? '#fff' : c.ink} size={20} />}
        onPress={onBack}
      />
      {actionIcon ? (
        <IconBtn
          onDark={onDark}
          icon={<Icon name={actionIcon} color={onDark ? '#fff' : c.ink} size={20} />}
          onPress={onAction}
        />
      ) : (
        <Box w={36} />
      )}
    </>
  );

  return (
    <Box
      pos="absolute"
      t={0}
      l={0}
      r={0}
      zi={20}
      onLayout={(e) => onHeight?.(e.nativeEvent.layout.height)}
    >
      {/* En reposo el header NO pinta nada: como va encima del scroll y el
          degradado del hero arranca en y=0, el azul que se ve a través es el
          del propio hero. Pintar acá un `primary` plano era justamente el
          problema — el hero en esa franja ya va camino a `primary2`, así que
          el parche plano dejaba una junta visible. */}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, cristal]}>
        {/* BlurView directo y no GlassSurface: acá el cristal es un rectángulo a
            sangre, sin radio ni contenido, y en esa forma el GlassView nativo no
            llega a dibujar nada. El material del tema es el mismo que usa la
            tab bar, así que el vidrio de la app se ve igual en los dos lados. */}
        <BlurView
          tint={b.tint}
          intensity={b.intensity}
          style={[StyleSheet.absoluteFill, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.glassEdge }]}
        />
      </Animated.View>

      {/* Juego claro: encima, pero transparente a los toques. */}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, relleno, cristal]}>
        <Row jc="space-between" ai="center">
          {botones(false)}
        </Row>
      </Animated.View>

      {/* Juego oscuro: en flujo. Fija el alto y es el que se toca. */}
      <Animated.View style={[relleno, azul]}>
        <Row jc="space-between" ai="center">
          {botones(true)}
        </Row>
      </Animated.View>
    </Box>
  );
}
