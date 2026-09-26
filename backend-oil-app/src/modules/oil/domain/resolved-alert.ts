// Si un cambio de aceite atendió una alerta, y de qué nivel.
//
// No hace falta guardar un historial de alertas para saberlo: el estado en
// que estaba el vehículo al momento del cambio se RECALCULA exacto con el
// ciclo anterior y el km del propio cambio, que es una lectura real de ese
// día. Por eso funciona también con los cambios registrados antes de que
// esto existiera, y se corrige solo si se edita o borra un cambio.
import { computeOilStatus } from './oil-status.calculator';
import type { OilChangeRecord } from './oil-change.repository';
import type { OilCycle } from './oil-status';

export type ResolvedAlert = 'warn' | 'danger';

/** El cambio tal como sale por la API: con la alerta que atendió, o null si
 *  se hizo sin que hubiera ninguna (un cambio adelantado, o el primero). */
export type OilChangeView = OilChangeRecord & {
  resolvedAlert: ResolvedAlert | null;
};

/** Le pone al cambio la alerta que resolvió, dado el cambio que lo precedió. */
export const conAlertaResuelta = (
  cambio: OilChangeRecord,
  anterior: OilChangeRecord | null,
): OilChangeView => ({
  ...cambio,
  resolvedAlert: alertaResuelta(
    anterior && {
      km: anterior.km,
      changedAt: anterior.changedAt,
      intervalKm: anterior.intervalKm,
      intervalMonths: anterior.intervalMonths,
    },
    cambio,
  ),
});

export function alertaResuelta(
  anterior: OilCycle | null,
  cambio: { km: number; changedAt: Date },
): ResolvedAlert | null {
  // Sin ciclo anterior no había nada que vencer.
  if (!anterior) return null;

  const { gauge } = computeOilStatus({
    now: cambio.changedAt,
    // La lectura es del mismo día que `now`, así que el calculador la toma
    // como real y no proyecta: el ritmo no interviene.
    kmPerDay: 0,
    lastReading: { km: cambio.km, readAt: cambio.changedAt },
    cycle: anterior,
  });

  if (!gauge || gauge.status === 'ok') return null;
  return gauge.status;
}
