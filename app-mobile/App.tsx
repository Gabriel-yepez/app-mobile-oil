// Ruédalo — entry point: fuentes + tema del sistema + navegación
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TamaguiProvider, Theme } from '@tamagui/core';
import { useFonts, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import { JetBrainsMono_600SemiBold, JetBrainsMono_700Bold } from '@expo-google-fonts/jetbrains-mono';
import config from './tamagui.config';
import { useColorScheme, useNativeAppearance } from './src/ui';
import { useThemePref } from './src/store/themePref';
import { AppNavigator } from './src/navigation';
import { useNotificationResponse, useNotificationsSync } from './src/notifications';

export default function App() {
  // Preferencia del usuario y, si eligió "sistema", el ajuste del teléfono.
  // Para que "sistema" reaccione en caliente hace falta userInterfaceStyle:
  // "automatic" en app.json — si queda en "light", el SO reporta siempre
  // 'light'. "Claro" y "Oscuro" mandan igual, porque no consultan al sistema.
  const scheme = useColorScheme();

  // Lleva la preferencia al lado nativo: teclado, Alert y menús del sistema.
  // Sin esto, elegir "oscuro" deja la app oscura pero el teclado claro.
  useNativeAppearance();
  const themeHydrated = useThemePref((s) => s.hydrated);

  // Programa y reconcilia las notificaciones locales. Va antes del return
  // temprano por fuentes: los hooks deben llamarse siempre en el mismo orden.
  useNotificationsSync();
  useNotificationResponse();

  const [fontsLoaded] = useFonts({
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    SpaceGrotesk_700Bold,
    JetBrainsMono_600SemiBold,
    JetBrainsMono_700Bold,
  });

  // Se espera también al tema guardado: si no, quien tenga "oscuro" ve un
  // destello claro en cada arranque. Es gratis — las fuentes tardan más que
  // leer una clave del almacenamiento.
  if (!fontsLoaded || !themeHydrated) return null;

  return (
    // Raíz de gestos: por fuera de todo. Si falta, los gestos de
    // react-native-gesture-handler simplemente no disparan, sin error.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <TamaguiProvider config={config} defaultTheme={scheme}>
        <Theme name={scheme}>
          <SafeAreaProvider>
            <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
            <AppNavigator scheme={scheme} />
          </SafeAreaProvider>
        </Theme>
      </TamaguiProvider>
    </GestureHandlerRootView>
  );
}
