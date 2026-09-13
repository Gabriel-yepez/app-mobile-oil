// Tab bar flotante de cristal con FAB central — 5 items: Inicio, Vehículos, +,
// Alertas, Perfil.
//
// El cristal (liquid glass en iOS 26, blur nativo en el resto) lo resuelve
// GlassSurface; aquí solo se decide la composición. Dos decisiones que no son
// obvias mirando el resultado:
//
//  · No hay degradado que funda la barra con el fondo. Lo había cuando la pill
//    era opaca; con cristal sobraría y además taparía justo lo que tiene que
//    verse pasar por debajo.
//
//  · El FAB vive FUERA del cristal. Sobresale 22px por arriba, y GlassSurface
//    recorta su contenido (`overflow: 'hidden'`, que es lo que redondea el
//    desenfoque). Dentro quedaría decapitado.
import React from 'react';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Box, Row, Touchable, Txt, useAppColors, useShadows } from '../ui';
import { GlassSurface } from './GlassSurface';
import { Icon, IconName } from './Icon';

const TAB_META: Record<string, { label: string; icon: IconName }> = {
  Home: { label: 'Inicio', icon: 'home' },
  Vehicles: { label: 'Vehículos', icon: 'car' },
  Alerts: { label: 'Alertas', icon: 'bell' },
  Me: { label: 'Perfil', icon: 'user' },
};

const BAR_HEIGHT = 64;
const BAR_RADIUS = 26;
const FAB_SIZE = 52;

export function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const c = useAppColors();
  const sh = useShadows();
  const routes = state.routes.filter((r) => TAB_META[r.name]);

  const renderTab = (routeName: string) => {
    const route = routes.find((r) => r.name === routeName);
    if (!route) return null;
    const isActive = state.routes[state.index]?.name === routeName;
    const meta = TAB_META[routeName];
    const color = isActive ? c.solid : c.muted2;
    return (
      <Touchable
        key={routeName}
        onPress={() => navigation.navigate(routeName)}
        fade
        transition="quick"
        h={52}
        f={1}
        ai="center"
        jc="center"
        gap={2}
      >
        {/* Lente del item activo. Sobre un fondo desenfocado el color solo no
            alcanza para marcar el estado: el contraste depende de lo que pase
            por debajo en ese momento. */}
        {isActive && (
          <Box pos="absolute" t={0} b={0} l={4} r={4} br={16} bg={c.glassLens} pointerEvents="none" />
        )}
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
            {renderTab('Home')}
            {renderTab('Vehicles')}
            {/* Hueco del FAB: lo mantiene centrado sin sacarlo del cristal a
                ojo — los dos tabs de cada lado reparten el resto por igual. */}
            <Box w={FAB_SIZE + 12} />
            {renderTab('Alerts')}
            {renderTab('Me')}
          </Row>
        </GlassSurface>

        {/* FAB central → flujo agregar vehículo. Sólido a propósito: es la
            acción primaria y tiene que saltar por encima del cristal, no
            fundirse en él. */}
        <Box pos="absolute" t={-22} l={0} r={0} ai="center" pointerEvents="box-none">
          <Touchable
            onPress={() => navigation.navigate('AddVehicleType' as never)}
            fade
            sink
            transition="quick"
            h={FAB_SIZE}
            w={FAB_SIZE}
            ai="center"
            jc="center"
            br={18}
            bg="$solid"
            style={sh.primary}
          >
            <Icon name="plus" color="#fff" size={24} />
          </Touchable>
        </Box>
      </Box>
    </Box>
  );
}
