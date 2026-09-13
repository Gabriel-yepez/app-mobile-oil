// Envoltorio navy para los widgets que nacieron dentro del hero.
//
// OilGauge y el readout técnico cablean rgba(255,255,255,...) y tone="onDark":
// funcionan solo sobre fondo oscuro. En vez de adaptarlos al tema claro —lo que
// obligaría a rediseñar los arcos y ticks del gauge— se les da su propio fondo,
// y así pueden caer en cualquier posición de la lista sin volverse ilegibles.
import React, { ReactNode } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Box, useAppColors } from '../ui';
import { TechGrid } from '../components/primitives';

export function DarkWidgetSurface({ children }: { children: ReactNode }) {
  const c = useAppColors();
  return (
    <Box mx="$lg" br={20} overflow="hidden">
      <LinearGradient
        colors={[c.primary, c.primary2]}
        style={{ paddingHorizontal: 16, paddingVertical: 16 }}
      >
        <TechGrid height={320} />
        {children}
      </LinearGradient>
    </Box>
  );
}
