// Canal de notificaciones de Android. Debe existir ANTES de pedir el permiso:
// si no, el diálogo de Android 13+ aparece sin nombre de canal.
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { palette } from '../theme';

export const CHANNEL_ID = 'oil-reminders';

export async function ensureChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Recordatorios de aceite',
    description: 'Avisos de cambio próximo, vencido y recordatorio semanal.',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: palette.accent,
  });
}
