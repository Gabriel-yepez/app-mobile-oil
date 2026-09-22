// Tipos del subsistema de notificaciones. Sin imports del SDK a propósito.
//
// Lo que decide QUÉ avisar y CUÁNDO vive ahora en el backend: acá solo queda
// lo que la app necesita para recibir un push y saber a dónde llevar al
// usuario cuando lo toque.

/** Prefijo de los avisos que programaba la versión local. Lo único que lo
 *  usa hoy es legacy-cleanup, para cancelar solo lo nuestro. */
export const NOTIF_PREFIX = 'ruedalo:';

export type NotifKind = 'warn' | 'overdue' | 'checkin';

export type NotifRouteData = {
  screen: 'VehicleDetail' | 'Alerts';
  vehicleId?: string;
};

export type NotifPrefs = {
  enabled: boolean;
  warnEnabled: boolean;
  overdueEnabled: boolean;
  checkinEnabled: boolean;
  warnThresholdKm: number;
  /** 1..7, domingo = 1 (convención del trigger WEEKLY de Expo). */
  checkinWeekday: number;
  checkinHour: number;
  checkinMinute: number;
  /** epoch ms de cuándo se mostró el diálogo nativo; null = nunca. */
  permissionAskedAt: number | null;
};

export const DEFAULT_PREFS: NotifPrefs = {
  enabled: true,
  warnEnabled: true,
  overdueEnabled: true,
  checkinEnabled: true,
  warnThresholdKm: 500,
  checkinWeekday: 1,
  checkinHour: 9,
  checkinMinute: 0,
  permissionAskedAt: null,
};
