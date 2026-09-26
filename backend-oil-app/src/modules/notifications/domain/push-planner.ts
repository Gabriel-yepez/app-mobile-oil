// Motor de decisión — PURO. No importa Nest, ni Prisma, ni el SDK de Expo.
// Recibe estado, devuelve la lista exacta de avisos que deberían salir.
// Es el equivalente servidor de app-mobile/src/notifications/plan.ts.
import type { Gauge } from '../../oil/domain/oil-status';
import {
  DIAS_LECTURA_VIEJA,
  DIAS_REPETIR_VENCIDO,
  type NotificationPrefs,
  type PlannerVehicle,
  type PushMessage,
} from './push-message';

const DIA_MS = 86_400_000;

const fmtKm = (n: number) => Math.abs(Math.round(n)).toLocaleString('es-VE');

/** Firma del ciclo vigente: cambiar el aceite la cambia, y solo eso. */
const firmaCiclo = (v: PlannerVehicle) =>
  `${v.lastChangeAt?.toISOString() ?? 'sin-ciclo'}:${v.lastChangeKm ?? 0}`;

/**
 * Días que el vehículo lleva vencido, derivados del MEDIDOR y no de la
 * bitácora — por eso esta función sigue siendo pura.
 *
 * Un vehículo puede estar vencido por km, por tiempo o por los dos, y los dos
 * ejes hablan unidades distintas: `kmLeft` mide km y `daysLeft` mide días.
 * `kmPerDay` es lo que permite traerlos a la misma unidad, y se toma el que
 * lleva más tiempo vencido.
 */
function diasVencido(gauge: Gauge, kmPerDay: number): number {
  const porKm = gauge.kmLeft < 0 && kmPerDay > 0 ? -gauge.kmLeft / kmPerDay : 0;
  const porTiempo = gauge.daysLeft < 0 ? -gauge.daysLeft : 0;
  return Math.max(porKm, porTiempo);
}

/** Año y número de semana ISO: hace que el checkin sea uno por semana. */
function semanaIso(d: Date): string {
  const x = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
  // Al jueves de esa semana: la semana ISO es la que contiene su jueves.
  x.setUTCDate(x.getUTCDate() + 4 - (x.getUTCDay() || 7));
  const inicio = new Date(Date.UTC(x.getUTCFullYear(), 0, 1));
  const semana = Math.ceil(((x.getTime() - inicio.getTime()) / DIA_MS + 1) / 7);
  return `${x.getUTCFullYear()}-W${String(semana).padStart(2, '0')}`;
}

export function planPushes(input: {
  now: Date;
  userId: string;
  prefs: NotificationPrefs;
  vehicles: PlannerVehicle[];
  yaEnviado: Set<string>;
}): PushMessage[] {
  const { now, userId, prefs, vehicles, yaEnviado } = input;

  // Sin el interruptor maestro el plan es vacío, sin caso especial por tipo.
  if (!prefs.enabled) return [];

  const out: PushMessage[] = [];
  const agregar = (m: PushMessage) => {
    if (!yaEnviado.has(m.sig)) out.push(m);
  };

  for (const v of vehicles) {
    const g = v.status.gauge;
    // Sin ciclo no hay nada que vencer.
    if (!g) continue;
    // Pospuesta por el usuario. Al vencer el plazo, el mismo barrido la
    // retoma: la firma no incluye el posponer, así que no se pierde ningún
    // aviso que no se haya mandado.
    if (v.alertSnoozedUntil && v.alertSnoozedUntil > now) continue;

    if (g.kmLeft <= 0 || g.daysLeft <= 0) {
      if (!prefs.overdueEnabled) continue;
      const tramo = Math.floor(
        diasVencido(g, v.kmPerDay) / DIAS_REPETIR_VENCIDO,
      );
      agregar({
        kind: 'overdue',
        userId,
        vehicleId: v.id,
        title: 'Cambio de aceite vencido',
        body:
          g.kmLeft <= 0
            ? `${v.label} pasó ${fmtKm(g.kmLeft)} km del cambio recomendado.`
            : `${v.label} pasó ${fmtKm(g.daysLeft)} días del cambio recomendado.`,
        sig: `overdue:${v.id}:${firmaCiclo(v)}:${tramo}`,
        data: { screen: 'VehicleDetail', vehicleId: v.id },
      });
      continue;
    }

    if (g.kmLeft <= prefs.warnThresholdKm) {
      if (!prefs.warnEnabled) continue;
      agregar({
        kind: 'warn',
        userId,
        vehicleId: v.id,
        title: 'Cambio de aceite cerca',
        body: `A ${v.label} le quedan ${fmtKm(g.kmLeft)} km para el cambio.`,
        // SIN el tramo: el warn es uno por ciclo y punto.
        sig: `warn:${v.id}:${firmaCiclo(v)}`,
        data: { screen: 'VehicleDetail', vehicleId: v.id },
      });
    }
  }

  // El checkin ya no existe porque "el kilometraje no avanza solo" —acá sí
  // avanza, computeOilStatus lo proyecta—. Existe porque esa proyección se
  // degrada mientras nadie confirme un odómetro real.
  if (prefs.checkinEnabled && now.getUTCDay() + 1 === prefs.checkinWeekday) {
    const viejos = vehicles.filter((v) => {
      const asOf = v.status.odometer?.asOf;
      return (
        asOf !== undefined &&
        (now.getTime() - asOf.getTime()) / DIA_MS > DIAS_LECTURA_VIEJA
      );
    });

    if (viejos.length > 0) {
      agregar({
        kind: 'checkin',
        userId,
        vehicleId: null,
        title: 'Confírmanos tu kilometraje',
        body:
          viejos.length === 1
            ? `Hace rato no nos dices el odómetro de ${viejos[0].label}. Confírmalo para que el cálculo siga siendo fiel.`
            : `Hace rato no nos dices el odómetro de ${viejos.length} de tus vehículos. Confírmalo para que el cálculo siga siendo fiel.`,
        sig: `checkin:${userId}:${semanaIso(now)}`,
        data: { screen: 'Alerts' },
      });
    }
  }

  return out;
}
