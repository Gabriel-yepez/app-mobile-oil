// Qué pasa al tocar una notificación: navegar al vehículo del aviso, o a la
// pantalla de Alertas si es el recordatorio semanal.
import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { navigationRef, runWhenReady } from '../navigation/navigationRef';
import { NotifRouteData } from './types';

function navigate(data: NotifRouteData): void {
  runWhenReady(() => {
    if (data.screen === 'VehicleDetail' && data.vehicleId) {
      navigationRef.navigate('VehicleDetail', { vehicleId: data.vehicleId });
      return;
    }
    navigationRef.navigate('Alerts');
  });
}

function toRouteData(response: Notifications.NotificationResponse | null): NotifRouteData | null {
  const data = response?.notification.request.content.data as
    | Record<string, unknown>
    | undefined;
  if (!data) return null;
  const screen = data.screen;
  if (screen !== 'VehicleDetail' && screen !== 'Alerts') return null;
  return {
    screen,
    vehicleId: typeof data.vehicleId === 'string' ? data.vehicleId : undefined,
  };
}

export function useNotificationResponse(): void {
  useEffect(() => {
    if (Platform.OS === 'web') return;

    // Arranque en frío: la app se abrió tocando una notificación.
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      const data = toRouteData(response);
      if (data) navigate(data);
    });

    // App ya viva (primer o segundo plano).
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = toRouteData(response);
      if (data) navigate(data);
    });

    return () => sub.remove();
  }, []);
}
