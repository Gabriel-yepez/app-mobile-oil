import type { NotificationPrefs } from './push-message';

export const NOTIFICATION_PREF_REPOSITORY = Symbol(
  'NOTIFICATION_PREF_REPOSITORY',
);

export interface NotificationPrefRepository {
  /** Sin fila devuelve DEFAULT_PREFS y NO escribe: leer no crea nada. */
  obtener(userId: string): Promise<NotificationPrefs>;
  /** Upsert parcial: las claves ausentes del patch no se tocan. */
  guardar(
    userId: string,
    patch: Partial<NotificationPrefs>,
  ): Promise<NotificationPrefs>;
}
