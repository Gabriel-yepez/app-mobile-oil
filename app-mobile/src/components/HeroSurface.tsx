// Superficie navy con el degradado de marca.
//
// La usan los tres heroes (Inicio, Perfil, Detalle de vehículo) y las cards
// oscuras del inicio. Un solo componente y no un LinearGradient suelto en cada
// pantalla: cuando cada una traía su propio par de colores, dos superficies
// navy contiguas no coincidían y la junta se veía.
//
// Los colores y la diagonal viven en el tema (`heroGradient`), así que cambiar
// el material de la app es tocar un objeto.
import React, { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useHeroGradient } from '../ui';
import { heroGradientAxis } from '../theme';

export function HeroSurface({
  style,
  children,
}: {
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}) {
  const g = useHeroGradient();
  return (
    <LinearGradient
      colors={g.colors}
      locations={g.locations}
      start={heroGradientAxis.start}
      end={heroGradientAxis.end}
      style={style}
    >
      {children}
    </LinearGradient>
  );
}

/** Tono con el que ARRANCA la rampa. Es el que va detrás del hero cuando el
 *  scroll rebota hacia abajo: ahí se ve la zona de arriba del degradado, así
 *  que un `primary` plano dejaría un escalón justo en el borde. */
export function useHeroTopColor() {
  return useHeroGradient().colors[0];
}
