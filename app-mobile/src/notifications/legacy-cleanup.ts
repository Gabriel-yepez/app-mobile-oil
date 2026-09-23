// Retirada de las notificaciones locales.
//
// Con el servidor decidiendo, dejar el planificador local vivo duplicaría los
// avisos. Pero borrar su código no basta: los avisos YA programados viven en
// el sistema operativo y sobreviven a la actualización de la app, así que sin
// esta limpieza seguirían saliendo durante semanas, además de los push.
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { NOTIF_PREFIX } from './types';

export async function limpiarAvisosLocales(): Promise<number> {
  if (Platform.OS === 'web') return 0;

  try {
    const todas = await Notifications.getAllScheduledNotificationsAsync();
    // Solo lo nuestro: el prefijo es lo que distingue nuestros avisos de los
    // que haya programado cualquier otra cosa.
    const nuestras = todas.filter((n) => n.identifier.startsWith(NOTIF_PREFIX));

    for (const n of nuestras) {
      await Notifications.cancelScheduledNotificationAsync(n.identifier);
    }
    return nuestras.length;
  } catch {
    // Que la limpieza falle no puede impedir que la app arranque.
    return 0;
  }
}
