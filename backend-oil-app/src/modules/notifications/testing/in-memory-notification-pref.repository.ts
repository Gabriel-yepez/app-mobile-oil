import type { NotificationPrefRepository } from '../domain/notification-pref.repository';
import { DEFAULT_PREFS, type NotificationPrefs } from '../domain/push-message';

export class InMemoryNotificationPrefRepository implements NotificationPrefRepository {
  readonly filas = new Map<string, NotificationPrefs>();

  obtener(userId: string): Promise<NotificationPrefs> {
    return Promise.resolve(this.filas.get(userId) ?? DEFAULT_PREFS);
  }

  guardar(
    userId: string,
    patch: Partial<NotificationPrefs>,
  ): Promise<NotificationPrefs> {
    const actual = this.filas.get(userId) ?? DEFAULT_PREFS;
    const nuevo = { ...actual, ...patch };
    this.filas.set(userId, nuevo);
    return Promise.resolve(nuevo);
  }
}
