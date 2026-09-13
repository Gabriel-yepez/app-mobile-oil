// Motor de planificación — PURO. No importa expo-notifications ni React.
// Recibe estado, devuelve la lista exacta de notificaciones que deberían
// existir. Toda la lógica de negocio del subsistema vive aquí.
import { Vehicle } from '../data/mock';
import { kmLeft } from '../store/useStore';
import { fmtKm } from '../utils/format';
import { NOTIF_PREFIX, NotifPrefs, PlannedNotification, PlannedTrigger } from './types';

/** Hora local a la que se entregan los avisos de umbral. */
export const REMINDER_HOUR = 9;

/**
 * Próxima ocurrencia de `hour:minute` en hora local: hoy si aún no ha pasado,
 * mañana si ya pasó. Los avisos de umbral no se entregan al instante — si no,
 * le llegaría una notificación al usuario mientras mira la pantalla que la causó.
 */
export function nextOccurrence(now: Date, hour: number, minute = 0): number {
  const at = new Date(now.getTime());
  at.setHours(hour, minute, 0, 0);
  if (at.getTime() <= now.getTime()) at.setDate(at.getDate() + 1);
  return at.getTime();
}

const sigOf = (title: string, body: string, trigger: PlannedTrigger) =>
  `${title}|${body}|${JSON.stringify(trigger)}`;

const label = (v: Vehicle) => `${v.brand} ${v.model}`;

export function buildSchedule(input: {
  vehicles: Vehicle[];
  prefs: NotifPrefs;
  permissionGranted: boolean;
  now: Date;
}): PlannedNotification[] {
  const { vehicles, prefs, permissionGranted, now } = input;

  // Sin permiso o con el switch maestro apagado el plan es vacío: la
  // reconciliación entonces cancela todo lo nuestro, sin caso especial.
  if (!permissionGranted || !prefs.enabled) return [];

  const out: PlannedNotification[] = [];
  const trigger: PlannedTrigger = { type: 'date', date: nextOccurrence(now, REMINDER_HOUR) };

  for (const v of vehicles) {
    const left = kmLeft(v);

    // Vencido y próximo son mutuamente excluyentes: un vehículo nunca genera
    // los dos avisos.
    if (left <= 0) {
      if (!prefs.overdueEnabled) continue;
      const title = 'Cambio de aceite vencido';
      const body = `${label(v)} pasó ${fmtKm(Math.abs(left))} km del cambio recomendado.`;
      out.push({
        id: `${NOTIF_PREFIX}oil-overdue:${v.id}`,
        kind: 'overdue',
        title,
        body,
        sig: sigOf(title, body, trigger),
        data: { screen: 'VehicleDetail', vehicleId: v.id },
        trigger,
      });
      continue;
    }

    if (left <= prefs.warnThresholdKm) {
      if (!prefs.warnEnabled) continue;
      const title = 'Cambio de aceite cerca';
      const body = `A ${label(v)} le quedan ${fmtKm(left)} km de aceite.`;
      out.push({
        id: `${NOTIF_PREFIX}oil-warn:${v.id}`,
        kind: 'warn',
        title,
        body,
        sig: sigOf(title, body, trigger),
        data: { screen: 'VehicleDetail', vehicleId: v.id },
        trigger,
      });
    }
  }

  return out;
}
