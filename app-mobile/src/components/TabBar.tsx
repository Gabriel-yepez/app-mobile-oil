// Tab bar flotante con FAB central — 5 items: Inicio, Vehículos, +, Alertas, Perfil
import React from 'react';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Pressable, Text, View } from '../tw';
import { palette, T } from '../theme';
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
        className="h-[52px] flex-1 items-center justify-center gap-0.5"
      >
        <Icon name={meta.icon} color={color} size={22} />
        <Text className="font-sans-semi text-[10px] tracking-[0.3px]" style={{ color }}>
          {meta.label}
        </Text>
      </Pressable>
    );
  };

  return (
    <View
      className="absolute bottom-0 left-0 right-0 pt-1.5"
      style={{ paddingBottom: Math.max(insets.bottom, 24) }}
      pointerEvents="box-none"
    >
      <LinearGradient
        colors={['rgba(255,255,255,0)', '#ffffff']}
        style={{ position: 'absolute', top: -10, left: 0, right: 0, bottom: 0 }}
        pointerEvents="none"
      />
      <View className="mx-4 h-16 flex-row items-center justify-around rounded-[22px] border border-line bg-white px-1.5 shadow-tabbar">
        {renderTab('Home')}
        {renderTab('Vehicles')}

        {/* FAB central → flujo agregar vehículo */}
        <Pressable
          onPress={() => navigation.navigate('AddVehicleType' as never)}
          className="-mt-[22px] h-[52px] w-[52px] items-center justify-center rounded-[18px] bg-primary shadow-primary active:opacity-85"
        >
          <Icon name="plus" color="#fff" size={24} />
        </Pressable>

        {renderTab('Alerts')}
        {renderTab('Me')}
      </View>
    </View>
  );
}
