// Tab bar flotante con FAB central — 5 items: Inicio, Vehículos, +, Alertas, Perfil
import React from 'react';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Box, Row, Touchable, Txt, useAppColors, useShadows } from '../ui';
import { Icon, IconName } from './Icon';

const TAB_META: Record<string, { label: string; icon: IconName }> = {
  Home: { label: 'Inicio', icon: 'home' },
  Vehicles: { label: 'Vehículos', icon: 'car' },
  Alerts: { label: 'Alertas', icon: 'bell' },
  Me: { label: 'Perfil', icon: 'user' },
};

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
        <Icon name={meta.icon} color={color} size={22} />
        <Txt font="semi" fos={10} ls={0.3} col={color}>
          {meta.label}
        </Txt>
      </Touchable>
    );
  };

  return (
    <Box pos="absolute" b={0} l={0} r={0} pt={6} pb={Math.max(insets.bottom, 24)} pointerEvents="box-none">
      {/* Degradado que funde la barra con el fondo de la pantalla. */}
      <LinearGradient
        colors={[`${c.bg3}00`, c.bg3]}
        style={{ position: 'absolute', top: -10, left: 0, right: 0, bottom: 0 }}
        pointerEvents="none"
      />
      <Row
        mx="$lg"
        h={64}
        jc="space-around"
        br={22}
        bw={1}
        px={6}
        bc="$line"
        bg="$surface"
        style={sh.tabbar}
      >
        {renderTab('Home')}
        {renderTab('Vehicles')}

        {/* FAB central → flujo agregar vehículo */}
        <Touchable
          onPress={() => navigation.navigate('AddVehicleType' as never)}
          fade
          sink
          transition="quick"
          mt={-22}
          h={52}
          w={52}
          ai="center"
          jc="center"
          br={18}
          bg="$solid"
          style={sh.primary}
        >
          <Icon name="plus" color="#fff" size={24} />
        </Touchable>

        {renderTab('Alerts')}
        {renderTab('Me')}
      </Row>
    </Box>
  );
}
