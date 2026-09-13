// Lectura y solicitud del permiso del SO.
//
// El estado NO se persiste: se lee del sistema cada vez, porque el usuario
// puede revocarlo desde Ajustes sin que la app se entere.
//
// Ojo con iOS: el diálogo nativo se muestra UNA sola vez por instalación. Si
// el usuario lo deniega, la única vía es openSystemSettings().
import * as Notifications from 'expo-notifications';
import { Linking, Platform } from 'react-native';
import { ensureChannel } from './channels';

export type PermissionState = 'granted' | 'denied' | 'undetermined';

// `status` se tipa como string a propósito: el enum PermissionStatus viene
// reexportado de expo-modules-core y no es parte estable del API público.
const toState = (status: string): PermissionState =>
  status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'undetermined';

export async function getPermissionState(): Promise<PermissionState> {
  if (Platform.OS === 'web') return 'denied';
  const { status } = await Notifications.getPermissionsAsync();
  return toState(status);
}

export async function isPermissionGranted(): Promise<boolean> {
  return (await getPermissionState()) === 'granted';
}

export async function requestPermission(): Promise<PermissionState> {
  if (Platform.OS === 'web') return 'denied';
  await ensureChannel();
  const { status } = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: false, allowSound: true },
  });
  return toState(status);
}

/** Abre la ficha de la app en los ajustes del teléfono. */
export function openSystemSettings(): void {
  void Linking.openSettings();
}
