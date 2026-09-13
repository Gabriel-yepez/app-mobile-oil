// Tab bar flotante de cristal — tres destinos: Inicio, Vehículos, Menú.
//
// El cristal (liquid glass en iOS 26, blur nativo en el resto) lo resuelve
// GlassSurface; aquí solo se decide la composición. Dos decisiones que no son
// obvias mirando el resultado:
//
//  · No hay degradado que funda la barra con el fondo. Lo había cuando la pill
//    era opaca; con cristal sobraría y además taparía justo lo que tiene que
//    verse pasar por debajo.
//
//  · La lente del item activo es UNA sola y se desplaza, en vez de una por tab
//    que aparece y desaparece. Ver abajo.
import React, { useState } from 'react';
import { LayoutChangeEvent } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Box, Row, Touchable, Txt, useAppColors, useShadows } from '../ui';
import { GlassSurface } from './GlassSurface';
import { Icon, IconName } from './Icon';

const TAB_META: Record<string, { label: string; icon: IconName }> = {
  Home: { label: 'Inicio', icon: 'home' },
  Vehicles: { label: 'Vehículos', icon: 'car' },
  Menu: { label: 'Menú', icon: 'menu' },
};

const BAR_HEIGHT = 64;
const BAR_RADIUS = 26;
/** Aire entre la lente y el borde de su tab. */
const LENS_INSET = 4;

/** Rectángulo de un tab dentro del Row, en coordenadas del Row. */
type Slot = { x: number; y: number; w: number; h: number };

export function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const c = useAppColors();
  const sh = useShadows();
  const routes = state.routes.filter((r) => TAB_META[r.name]);
  const activeName = state.routes[state.index]?.name;

  // Las posiciones se MIDEN, no se calculan. Se podrían deducir del ancho de la
  // barra dividido por la cantidad de tabs, pero esa fórmula quedaría atada a
  // los números de hoy; midiendo, la lente sigue cayendo bien si se agrega o se
  // quita un destino. Es justamente lo que la salvó al pasar de cinco a tres.
  const [slots, setSlots] = useState<Record<string, Slot>>({});
  const lens = activeName ? slots[activeName] : undefined;

  const measure = (routeName: string) => (e: LayoutChangeEvent) => {
    const { x, y, width, height } = e.nativeEvent.layout;
    setSlots((prev) => {
      const old = prev[routeName];
      // Sin esta comparación, cada onLayout dispara un render que vuelve a
      // disparar onLayout.
      if (old && old.x === x && old.y === y && old.w === width && old.h === height) return prev;
      return { ...prev, [routeName]: { x, y, w: width, h: height } };
    });
  };

  const renderTab = (routeName: string) => {
    const route = routes.find((r) => r.name === routeName);
    if (!route) return null;
    const isActive = activeName === routeName;
    const meta = TAB_META[routeName];
    const color = isActive ? c.solid : c.muted2;
    return (
      <Touchable
        key={routeName}
        onPress={() => navigation.navigate(routeName)}
        onLayout={measure(routeName)}
        fade
        transition="quick"
        h={52}
        f={1}
        ai="center"
        jc="center"
        gap={2}
      >
        <Icon name={meta.icon} color={color} size={22} />
        <Txt font="semi" fos={10} ls={0.3} col={color}>
          {meta.label}
        </Txt>
      </Touchable>
    );
  };

  return (
    <Box pos="absolute" b={0} l={0} r={0} pt={6} pb={Math.max(insets.bottom, 24)} pointerEvents="box-none">
      {/* La sombra va aquí, por fuera: en iOS un `overflow: 'hidden'` en la
          misma vista se la come, y el recorte es justo lo que redondea el
          cristal. */}
      <Box mx="$lg" br={BAR_RADIUS} style={sh.tabbar}>
        <GlassSurface radius={BAR_RADIUS} style={{ height: BAR_HEIGHT }}>
          <Row f={1} px={6} jc="space-around">
            {/* Lente del item activo. Sobre un fondo desenfocado el color solo
                no alcanza para marcar el estado: el contraste depende de lo que
                pase por debajo en ese momento.

                Va primero para que pinte DETRÁS de los iconos, y no se monta
                hasta tener medidas: así en el primer render aparece ya colocada
                en vez de viajar desde el borde izquierdo. */}
            {lens && (
              <Box
                pos="absolute"
                l={0}
                t={lens.y}
                h={lens.h}
                w={lens.w - LENS_INSET * 2}
                x={lens.x + LENS_INSET}
                br={16}
                bg={c.glassLens}
                transition="quick"
                pointerEvents="none"
              />
            )}

            {renderTab('Home')}
            {renderTab('Vehicles')}
            {renderTab('Menu')}
          </Row>
        </GlassSurface>

      </Box>
    </Box>
  );
}
