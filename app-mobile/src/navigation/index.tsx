// Navegación: stack raíz (auth + flujos) + bottom tabs con TabBar custom
import React from 'react';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { dark, light, palette } from '../theme';
import { TabBar } from '../components/TabBar';
import { useFirstRunPermission } from '../notifications';
import { RootStackParamList, TabParamList } from './types';
import { navigationRef, flushPendingRoute } from './navigationRef';

import { OnboardingScreen } from '../screens/OnboardingScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { SignupScreen } from '../screens/SignupScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { VehiclesScreen } from '../screens/VehiclesScreen';
import { AlertsScreen } from '../screens/AlertsScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { VehicleDetailScreen } from '../screens/VehicleDetailScreen';
import { AddVehicleTypeScreen } from '../screens/AddVehicleTypeScreen';
import { AddVehicleFormScreen } from '../screens/AddVehicleFormScreen';
import { AddOilScreen } from '../screens/AddOilScreen';
import { HistoryScreen } from '../screens/HistoryScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

function Tabs() {
  useFirstRunPermission();

  return (
    <Tab.Navigator
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Vehicles" component={VehiclesScreen} />
      <Tab.Screen name="Alerts" component={AlertsScreen} />
      <Tab.Screen name="Me" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

// El contenedor de navegación tiene su propio tema: sin esto el fondo entre
// pantallas sigue siendo blanco y se ve un flash claro al navegar en oscuro.
const navThemes = {
  light: {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      background: light.bg3,
      card: light.bg,
      text: light.ink,
      border: light.line,
      primary: palette.accent,
    },
  },
  dark: {
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      background: dark.bg3,
      card: dark.surface,
      text: dark.ink,
      border: dark.line,
      primary: dark.accent,
    },
  },
};

export function AppNavigator({ scheme }: { scheme: 'light' | 'dark' }) {
  return (
    <NavigationContainer theme={navThemes[scheme]} ref={navigationRef} onReady={flushPendingRoute}>
      <Stack.Navigator initialRouteName="Onboarding" screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Signup" component={SignupScreen} />
        <Stack.Screen name="Tabs" component={Tabs} />
        <Stack.Screen name="VehicleDetail" component={VehicleDetailScreen} />
        <Stack.Screen name="AddVehicleType" component={AddVehicleTypeScreen} />
        <Stack.Screen name="AddVehicleForm" component={AddVehicleFormScreen} />
        <Stack.Screen name="AddOil" component={AddOilScreen} />
        <Stack.Screen name="History" component={HistoryScreen} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
