// Token de push y registro contra el API. Es la única capa de la app que
// conoce el ExpoPushToken.
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import {
  notificationsController,
  type DevicePlatform,
} from '../api/controllers/notifications.controller';
import { isPermissionGranted } from './permissions';

const plataforma = (): DevicePlatform =>
  Platform.OS === 'ios' ? 'IOS' : 'ANDROID';

/**
 * El projectId de EAS, que vive en app.json. Sin él, getExpoPushTokenAsync no
 * sabe a qué proyecto pedirle el token.
 */
const projectId = (): string | undefined =>
  (Constants.expoConfig?.extra?.eas as { projectId?: string } | undefined)
    ?.projectId;

/**
 * El token de esta instalación, o null si no se puede obtener.
 *
 * El `try` envuelve TAMBIÉN la consulta del permiso, y eso no es exceso de
 * celo: si leerlo fallara, la excepción subiría hasta `signOut` y el usuario
 * no podría cerrar sesión por culpa de una notificación. Ningún fallo de acá
 * puede impedir algo que el usuario pidió.
 */
async function tokenDelDispositivo(): Promise<string | null> {
  if (Platform.OS === 'web') return null;

  try {
    if (!(await isPermissionGranted())) return null;

    const { data } = await Notifications.getExpoPushTokenAsync({
      projectId: projectId(),
    });
    return data;
  } catch {
    // En Expo Go el push remoto no existe (Android, desde SDK 53), así que
    // pedir el token lanza. No es un error: es la app corriendo donde no puede.
    return null;
  }
}

/**
 * Registra el dispositivo. Se llama al iniciar sesión y en cada arranque con
 * sesión viva, así que es idempotente y NUNCA propaga: un fallo de red no
 * puede impedir que la app abra.
 */
export async function registrarDispositivo(): Promise<string | null> {
  const token = await tokenDelDispositivo();
  if (!token) return null;

  try {
    await notificationsController.registrarDispositivo(token, plataforma());
    return token;
  } catch {
    return null;
  }
}

/**
 * Baja al cerrar sesión. Silenciosa a propósito: dejar al usuario dentro de su
 * cuenta porque el servidor no contesta sería peor que un token huérfano, y el
 * DeviceNotRegistered lo limpia solo.
 */
export async function darDeBajaDispositivo(): Promise<void> {
  const token = await tokenDelDispositivo();
  if (!token) return;

  try {
    await notificationsController.darDeBaja(token);
  } catch {
    // Silencio deliberado.
  }
}
