// El cálculo del estado del aceite. Función PURA: sin base, sin red y sin
// `new Date()` — `now` entra por parámetro. Esa decisión es la que permite
// probar "el 20 de diciembre esto está vencido" sin tocar el reloj del sistema.
import { addMonths, daysBetween, isSameUtcDay } from './dates';
import type {
  Gauge,
  Odometer,
  OdometerBase,
  OilStatus,
  OilStatusInput,
  OilStatusLevel,
} from './oil-status';

const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));

/**
 * Proyecta el odómetro desde la última lectura real.
 *
 * Esta es la respuesta al problema de fondo: el odómetro solo existe sentado en
 * el auto, así que entre cambio y cambio hay que estimarlo o la barra se
 * congela en el km del último cambio y miente.
 */
function projectOdometer(
  base: OdometerBase,
  kmPerDay: number,
  now: Date,
): Odometer {
  // Si la lectura es de hoy, el número es real y se reporta como tal: no tiene
  // sentido "estimar" sobre una medición de hace tres horas.
  if (isSameUtcDay(base.readAt, now)) {
    return { km: base.km, source: 'reported', asOf: base.readAt };
  }

  const dias = Math.max(0, daysBetween(base.readAt, now));
  // El max() cubre el reloj torcido: un odómetro no retrocede nunca.
  const km = Math.max(base.km, base.km + Math.round(kmPerDay * dias));
  return { km, source: 'estimated', asOf: base.readAt };
}

/**
 * El estado sale de la vida CRUDA, no del `pct` ya recortado: un aceite con
 * 0,4% de vida redondea a 0, y decirle VENCIDO a algo que todavía no venció es
 * exactamente el error que este umbral existe para no cometer.
 */
function statusFor(vidaCruda: number, pct: number): OilStatusLevel {
  if (vidaCruda <= 0) return 'danger';
  return pct > 40 ? 'ok' : 'warn';
}

export function computeOilStatus(input: OilStatusInput): OilStatus {
  const { now, kmPerDay, lastReading, cycle } = input;

  const odometer = lastReading
    ? projectOdometer(lastReading, kmPerDay, now)
    : null;

  if (!cycle || !odometer) return { computedAt: now, gauge: null, odometer };

  const limiteKm = cycle.km + cycle.intervalKm;
  const limiteFecha = addMonths(cycle.changedAt, cycle.intervalMonths);

  const kmLeft = limiteKm - odometer.km;
  const diasRestantes = daysBetween(now, limiteFecha);
  const diasTotales = daysBetween(cycle.changedAt, limiteFecha);

  const vidaKm = kmLeft / cycle.intervalKm;
  const vidaTiempo = diasRestantes / diasTotales;

  // El peor de los dos ejes: es el "5.000 km o 6 meses, lo que ocurra primero"
  // que trae el manual de cualquier vehículo. El que maneja mucho se le vence
  // por km; el que tiene el carro parado, por tiempo.
  const vidaCruda = Math.min(vidaKm, vidaTiempo);
  const pct = Math.round(clamp(vidaCruda, 0, 1) * 100);

  const gauge: Gauge = {
    pct,
    status: statusFor(vidaCruda, pct),
    limitedBy: vidaKm <= vidaTiempo ? 'km' : 'time',
    kmLeft,
    // floor y no round: si quedan 2,7 días se muestran 2. Redondear para
    // arriba le promete al usuario un día que no tiene.
    daysLeft: Math.floor(diasRestantes),
  };

  return { computedAt: now, gauge, odometer };
}
