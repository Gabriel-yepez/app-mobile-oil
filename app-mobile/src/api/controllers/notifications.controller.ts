// Endpoints de notificaciones. Un archivo por recurso, como el resto.
import { ApiClient } from '../base';

export type ApiNotifPrefs = {
  enabled: boolean;
  warnEnabled: boolean;
  overdueEnabled: boolean;
  checkinEnabled: boolean;
  warnThresholdKm: number;
  /** 1..7, domingo = 1: la convención del trigger WEEKLY de Expo. */
  checkinWeekday: number;
};

export type DevicePlatform = 'IOS' | 'ANDROID';

class NotificationsController extends ApiClient {
  constructor() {
    super('/me');
  }

  async registrarDispositivo(
    token: string,
    platform: DevicePlatform
  ): Promise<void> {
    await this.post<{ ok: true }>('/devices', {
      body: { token, platform },
      auth: true,
    });
  }

  async darDeBaja(token: string): Promise<void> {
    // El token viaja en la ruta y trae corchetes: sin codificar, la petición
    // sale malformada y el servidor no da de baja nada.
    await this.del<void>(`/devices/${encodeURIComponent(token)}`, {
      auth: true,
    });
  }

  async obtenerPrefs(): Promise<ApiNotifPrefs> {
    return this.get<ApiNotifPrefs>('/notification-prefs', { auth: true });
  }

  async guardarPrefs(
    patch: Partial<ApiNotifPrefs>
  ): Promise<ApiNotifPrefs> {
    return this.patch<ApiNotifPrefs>('/notification-prefs', {
      body: patch,
      auth: true,
    });
  }
}

export const notificationsController = new NotificationsController();
