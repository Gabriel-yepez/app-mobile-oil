// Los tipos del subsistema. Sin imports del SDK de Expo ni de Prisma a
// propósito: push-planner.ts depende solo de esto, y así queda testeable sin
// base y sin mocks.
import type { OilStatus } from '../../oil/domain/oil-status';

export type PushKind = 'warn' | 'overdue' | 'checkin';

export type PushRouteData = {
  screen: 'VehicleDetail' | 'Alerts';
  vehicleId?: string;
};

export type PushMessage = {
  kind: PushKind;
  userId: string;
  /** null en el checkin: es del usuario, no de un vehículo. */
  vehicleId: string | null;
  title: string;
  body: string;
  /** La firma del HECHO avisado. Ver el comentario en push-planner.ts. */
  sig: string;
  data: PushRouteData;
};

export type NotificationPrefs = {
  enabled: boolean;
  warnEnabled: boolean;
  overdueEnabled: boolean;
  checkinEnabled: boolean;
  warnThresholdKm: number;
  /** 1..7, domingo = 1: la convención del trigger WEEKLY de Expo. */
  checkinWeekday: number;
};

export const DEFAULT_PREFS: NotificationPrefs = {
  enabled: true,
  warnEnabled: true,
  overdueEnabled: true,
  checkinEnabled: true,
  warnThresholdKm: 500,
  checkinWeekday: 1,
};

export type PlannerVehicle = {
  id: string;
  /** Mientras sea futura, ni warn ni overdue: el usuario pidió silencio. */
  alertSnoozedUntil: Date | null;
  /** "Toyota Corolla": lo que se lee en el cuerpo de la notificación. */
  label: string;
  /**
   * El ritmo de uso. Es lo que permite llevar `kmLeft` y `daysLeft` —que miden
   * ejes distintos— a la misma unidad al calcular los días vencido.
   */
  kmPerDay: number;
  /**
   * El ciclo vigente: es lo que hace única la firma de warn y de overdue. Sin
   * él, cambiar el aceite no reiniciaría el dedupe.
   */
  lastChangeKm: number | null;
  lastChangeAt: Date | null;
  status: OilStatus;
};

/** Cada cuántos días vuelve el aviso de un vehículo que sigue vencido. */
export const DIAS_REPETIR_VENCIDO = 14;

/** Antigüedad a partir de la cual se pide confirmar el odómetro. */
export const DIAS_LECTURA_VIEJA = 30;

/**
 * Valida el formato sin arrastrar el SDK. `Expo.isExpoPushToken()` haría lo
 * mismo, pero obligaría a importar expo-server-sdk desde un DTO de HTTP.
 */
export function esTokenExpo(v: unknown): boolean {
  return typeof v === 'string' && /^Expo(nent)?PushToken\[[^\]\s]+\]$/.test(v);
}
