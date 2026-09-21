import type { NotificationPrefRepository } from '../domain/notification-pref.repository';
import { DEFAULT_PREFS, type NotificationPrefs } from '../domain/push-message';

export class InMemoryNotificationPrefRepository
  implements NotificationPrefRepository
{
  readonly filas = new Map<string, NotificationPrefs>();

  async obtener(userId: string): Promise<NotificationPrefs> {
    return this.filas.get(userId) ?? DEFAULT_PREFS;
  }

  async guardar(
    userId: string,
    patch: Partial<NotificationPrefs>,
  ): Promise<NotificationPrefs> {
    const actual = this.filas.get(userId) ?? DEFAULT_PREFS;
    const nuevo = { ...actual, ...patch };
    this.filas.set(userId, nuevo);
    return nuevo;
  }
}
