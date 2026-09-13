// Navegación: stack raíz (auth + flujos) + bottom tabs con TabBar custom
import React from 'react';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { dark, light, palette } from '../theme';
import { TabBar } from '../components/TabBar';
import { GlassBackdrop, GlassBlurTarget } from '../components/GlassSurface';
import { useFirstRunPermission } from '../notifications';
import { RootStackParamList, TabParamList } from './types';
import { navigationRef, flushPendingRoute } from './navigationRef';

import { OnboardingScreen } from '../screens/OnboardingScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { SignupScreen } from '../screens/SignupScreen';
import { ForgotPasswordScreen } from '../screens/ForgotPasswordScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { VehiclesScreen } from '../screens/VehiclesScreen';
import { AlertsScreen } from '../screens/AlertsScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { EditProfileScreen } from '../screens/EditProfileScreen';
import { SubscriptionScreen } from '../screens/SubscriptionScreen';
import { EditVehicleScreen } from '../screens/EditVehicleScreen';
import { MenuScreen } from '../screens/MenuScreen';
import { VehicleDetailScreen } from '../screens/VehicleDetailScreen';
import { AddVehicleTypeScreen } from '../screens/AddVehicleTypeScreen';
import { AddVehicleFormScreen } from '../screens/AddVehicleFormScreen';
import { AddOilScreen } from '../screens/AddOilScreen';
import { HistoryScreen } from '../screens/HistoryScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';
import { CustomizeHomeScreen } from '../screens/CustomizeHomeScreen';
import { SecuritySettingsScreen } from '../screens/SecuritySettingsScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

function Tabs() {
  useFirstRunPermission();

  // El cristal del tab bar necesita, en Android, que le señalen qué desenfocar.
  // `screenLayout` envuelve cada escena: es deliberado que el target sea la
  // pantalla y no el navegador entero — si el target contuviera al tab bar, el
  // árbol de render se cicla y hwui revienta la pila. Ver GlassSurface.tsx.
  return (
    <GlassBackdrop>
      <Tab.Navigator
        tabBar={(props) => <TabBar {...props} />}
        screenLayout={({ children }) => <GlassBlurTarget>{children}</GlassBlurTarget>}
        screenOptions={{ headerShown: false }}
      >
        <Tab.Screen name="Home" component={HomeScreen} />
        <Tab.Screen name="Vehicles" component={VehiclesScreen} />
        <Tab.Screen name="Menu" component={MenuScreen} />
      </Tab.Navigator>
    </GlassBackdrop>
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
        <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
        <Stack.Screen name="Tabs" component={Tabs} />
        <Stack.Screen name="VehicleDetail" component={VehicleDetailScreen} />
        <Stack.Screen name="EditVehicle" component={EditVehicleScreen} />
        <Stack.Screen name="AddVehicleType" component={AddVehicleTypeScreen} />
        <Stack.Screen name="AddVehicleForm" component={AddVehicleFormScreen} />
        <Stack.Screen name="AddOil" component={AddOilScreen} />
        <Stack.Screen name="History" component={HistoryScreen} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} />
        <Stack.Screen name="Alerts" component={AlertsScreen} />
        <Stack.Screen name="Profile" component={ProfileScreen} />
        <Stack.Screen name="EditProfile" component={EditProfileScreen} />
        <Stack.Screen name="Subscription" component={SubscriptionScreen} />
        <Stack.Screen name="CustomizeHome" component={CustomizeHomeScreen} options={{ presentation: 'modal' }} />
        <Stack.Screen name="SecuritySettings" component={SecuritySettingsScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
