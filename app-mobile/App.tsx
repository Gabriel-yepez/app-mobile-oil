// Ruédalo — entry point: fuentes + tema del sistema + navegación
import React, { useEffect } from 'react';
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
import { ToastHost } from './src/components/Toast';
import { useAuth } from './src/store/auth';
import { useStore } from './src/store/useStore';
import { useVehicles } from './src/store/useVehicles';
import { useBrands } from './src/store/useBrands';
import { useColors } from './src/store/useColors';
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

  // Sesión: lee el token del almacenamiento seguro y lo confirma contra /me.
  // Va antes del return temprano por fuentes, como el resto de hooks.
  const authStatus = useAuth((s) => s.status);
  const user = useAuth((s) => s.user);
  const bootstrap = useAuth((s) => s.bootstrap);
  const setProfileFromUser = useStore((s) => s.setProfileFromUser);

  // La flota: se hidrata del almacenamiento local siempre, y solo se refresca
  // y sincroniza con sesión activa. Hidratar sin sesión igual es correcto —
  // es lo que hace que la app abra mostrando los vehículos sin esperar red.
  const hidratarFlota = useVehicles((s) => s.hidratar);
  const refrescarFlota = useVehicles((s) => s.refresh);
  const sincronizarFlota = useVehicles((s) => s.sincronizar);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    if (user) setProfileFromUser(user);
  }, [user, setProfileFromUser]);

  useEffect(() => {
    void hidratarFlota();
  }, [hidratarFlota]);

  // El catálogo de marcas sigue el mismo ciclo que la flota.
  const hidratarMarcas = useBrands((s) => s.hidratar);
  const refrescarMarcas = useBrands((s) => s.refresh);
  const sincronizarMarcas = useBrands((s) => s.sincronizar);

  useEffect(() => {
    void hidratarMarcas();
  }, [hidratarMarcas]);

  // Los colores son solo lectura: hidratar y refrescar, sin cola que drenar.
  const hidratarColores = useColors((s) => s.hidratar);
  const refrescarColores = useColors((s) => s.refresh);

  useEffect(() => {
    void hidratarColores();
  }, [hidratarColores]);

  useEffect(() => {
    if (authStatus !== 'authed') return;
    void refrescarColores();
  }, [authStatus, refrescarColores]);

  useEffect(() => {
    if (authStatus !== 'authed') return;
    // Igual que la flota: primero se drena lo pendiente y después se refresca.
    // Al revés, la respuesta del servidor pisaría una marca que el usuario
    // agregó sin señal y que todavía no se envió.
    void sincronizarMarcas().then(() => refrescarMarcas());
  }, [authStatus, refrescarMarcas, sincronizarMarcas]);

  useEffect(() => {
    if (authStatus !== 'authed') return;
    // Primero se drena lo pendiente y después se refresca: al revés, la
    // respuesta del servidor pisaría en pantalla los cambios que el usuario
    // hizo sin señal y que todavía no se enviaron.
    void sincronizarFlota().then(() => refrescarFlota());
  }, [authStatus, refrescarFlota, sincronizarFlota]);

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
  // Se espera también a la sesión, por el mismo motivo que al tema: decidir
  // la ruta antes de saber si hay token haría que quien ya entró viera un
  // destello del Login antes de saltar a Tabs.
  if (!fontsLoaded || !themeHydrated || authStatus === 'loading') return null;

  return (
    // Raíz de gestos: por fuera de todo. Si falta, los gestos de
    // react-native-gesture-handler simplemente no disparan, sin error.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <TamaguiProvider config={config} defaultTheme={scheme}>
        <Theme name={scheme}>
          <SafeAreaProvider>
            <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
            <AppNavigator scheme={scheme} authed={authStatus === 'authed'} />
            {/* Después del navegador y dentro del SafeAreaProvider: así se
                pinta por encima de cualquier pantalla y conoce el notch. */}
            <ToastHost />
          </SafeAreaProvider>
        </Theme>
      </TamaguiProvider>
    </GestureHandlerRootView>
  );
}
