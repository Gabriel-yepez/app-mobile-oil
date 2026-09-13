// Punto de entrada del subsistema. Importar este módulo registra el handler
// que decide cómo se presenta una notificación con la app en primer plano.
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export { CHANNEL_ID, ensureChannel } from './channels';
export {
  getPermissionState,
  isPermissionGranted,
  openSystemSettings,
  requestPermission,
  type PermissionState,
} from './permissions';
export { buildSchedule, nextOccurrence, REMINDER_HOUR } from './plan';
export { reconcile, syncNotifications, type SyncResult } from './scheduler';
export { useFirstRunPermission } from './useFirstRunPermission';
export { useNotificationsSync } from './useNotificationsSync';
export * from './types';
