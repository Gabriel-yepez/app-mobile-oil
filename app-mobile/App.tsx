// OilTrack VE — entry point: fuentes + tema del sistema + navegación
import React from 'react';
import { useColorScheme } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TamaguiProvider, Theme } from '@tamagui/core';
import { useFonts, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import { JetBrainsMono_600SemiBold, JetBrainsMono_700Bold } from '@expo-google-fonts/jetbrains-mono';
import config from './tamagui.config';
import { AppNavigator } from './src/navigation';
import { useNotificationsSync } from './src/notifications';

export default function App() {
  // Sigue el ajuste del sistema y reacciona en caliente cuando el usuario lo
  // cambia. Requiere userInterfaceStyle: "automatic" en app.json — si queda en
  // "light", el SO reporta siempre 'light' y esto nunca cambia.
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';

  // Programa y reconcilia las notificaciones locales. Va antes del return
  // temprano por fuentes: los hooks deben llamarse siempre en el mismo orden.
  useNotificationsSync();

  const [fontsLoaded] = useFonts({
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    SpaceGrotesk_700Bold,
    JetBrainsMono_600SemiBold,
    JetBrainsMono_700Bold,
  });

  if (!fontsLoaded) return null;

  return (
    <TamaguiProvider config={config} defaultTheme={scheme}>
      <Theme name={scheme}>
        <SafeAreaProvider>
          <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
          <AppNavigator scheme={scheme} />
        </SafeAreaProvider>
      </Theme>
    </TamaguiProvider>
  );
}
