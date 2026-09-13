// Tipos del subsistema de notificaciones. Sin imports del SDK a propósito:
// plan.ts depende solo de esto, y así queda testeable sin mocks de Expo.

/** Prefijo de todo identificador programado por la app. La reconciliación
 *  ignora cualquier notificación que no lo lleve. */
export const NOTIF_PREFIX = 'ruedalo:';

export type NotifKind = 'warn' | 'overdue' | 'checkin';

/** Trigger propio, independiente del SDK. scheduler.ts lo traduce. */
export type PlannedTrigger =
  | { type: 'date'; date: number }
  | { type: 'weekly'; weekday: number; hour: number; minute: number };

export type NotifRouteData = {
  screen: 'VehicleDetail' | 'Alerts';
  vehicleId?: string;
};

export type PlannedNotification = {
  id: string;
  kind: NotifKind;
  title: string;
  body: string;
  /** Firma de contenido + trigger: distingue "ya programada y vigente" de
   *  "programada con datos viejos". */
  sig: string;
  data: NotifRouteData;
  trigger: PlannedTrigger;
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
