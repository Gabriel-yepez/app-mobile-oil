// Tab bar flotante con FAB central — 5 items: Inicio, Vehículos, +, Alertas, Perfil
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts, palette, radius, shadow, T } from '../theme';
import { Icon, IconName } from './Icon';

const TAB_META: Record<string, { label: string; icon: IconName }> = {
  Home: { label: 'Inicio', icon: 'home' },
  Vehicles: { label: 'Vehículos', icon: 'car' },
  Alerts: { label: 'Alertas', icon: 'bell' },
  Me: { label: 'Perfil', icon: 'user' },
};

export function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const routes = state.routes.filter((r) => TAB_META[r.name]);

  const renderTab = (routeName: string) => {
    const route = routes.find((r) => r.name === routeName);
    if (!route) return null;
    const isActive = state.routes[state.index]?.name === routeName;
    const meta = TAB_META[routeName];
    const color = isActive ? palette.primary : T.muted2;
    return (
      <Pressable
        key={routeName}
        onPress={() => navigation.navigate(routeName)}
        style={{ flex: 1, height: 52, alignItems: 'center', justifyContent: 'center', gap: 2 }}
      >
        <Icon name={meta.icon} color={color} size={22} />
        <Text style={{ fontFamily: fonts.sansSemi, fontSize: 10, letterSpacing: 0.3, color }}>{meta.label}</Text>
      </Pressable>
    );
  };

  return (
    <View
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingBottom: Math.max(insets.bottom, 24),
        paddingTop: 6,
      }}
      pointerEvents="box-none"
    >
      <LinearGradient
        colors={['rgba(255,255,255,0)', '#ffffff']}
        style={{ position: 'absolute', top: -10, left: 0, right: 0, bottom: 0 }}
        pointerEvents="none"
      />
      <View
        style={[
          {
            marginHorizontal: 16,
            height: 64,
            borderRadius: 22,
            backgroundColor: '#fff',
            borderWidth: 1,
            borderColor: T.line,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-around',
            paddingHorizontal: 6,
          },
          shadow.tabbar,
        ]}
      >
        {renderTab('Home')}
        {renderTab('Vehicles')}

        {/* FAB central → flujo agregar vehículo */}
        <Pressable
          onPress={() => navigation.navigate('AddVehicleType' as never)}
          style={({ pressed }) => [
            {
              width: 52,
              height: 52,
              borderRadius: 18,
              backgroundColor: palette.primary,
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: -22,
              opacity: pressed ? 0.85 : 1,
            },
            shadow.primary,
          ]}
        >
          <Icon name="plus" color="#fff" size={24} />
        </Pressable>

        {renderTab('Alerts')}
        {renderTab('Me')}
      </View>
    </View>
  );
}
