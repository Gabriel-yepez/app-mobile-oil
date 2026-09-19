// Recalibración del ritmo de uso. El usuario declara un número al dar de alta
// el vehículo, y desde el segundo cambio el ritmo pasa a ser el MEDIDO: km
// recorridos entre dos cambios, dividido por los días que pasaron entre ellos.
//
// Es lo que hace que la estimación deje de ser un promedio inventado y pase a
// ser la de ese vehículo.
import { daysBetween } from './dates';
import { KM_PER_DAY_MAX, KM_PER_DAY_MIN } from './oil-status';

export type RateSample = { km: number; changedAt: Date };

/**
 * Cuántos ciclos entran al promedio. Tres alcanza para amortiguar un mes raro
 * sin quedar anclado a cómo se usaba el vehículo hace dos años.
 */
const CICLOS_A_PROMEDIAR = 3;

/**
 * @param changes ciclos del vehículo, del MÁS NUEVO al más viejo.
 * @param fallback el ritmo declarado, que se usa mientras no haya nada medible.
 */
export function computeKmPerDay(
  changes: RateSample[],
  fallback: number,
): number {
  const ritmos: number[] = [];

  for (let i = 0; i < changes.length - 1; i++) {
    const nuevo = changes[i];
    const viejo = changes[i + 1];

    const dias = daysBetween(viejo.changedAt, nuevo.changedAt);
    // Dos cambios el mismo día no son un ciclo medible; sin esta guarda sería
    // una división por cero que devuelve Infinity y se persiste.
    if (dias <= 0) continue;

    const ritmo = (nuevo.km - viejo.km) / dias;
    // Fuera de rango no se rechaza el cambio: se descarta del promedio. Son el
    // dedazo en el odómetro y el vehículo que estuvo parado medio año — sin
    // este filtro, cualquiera de los dos envenena los tres ciclos siguientes.
    if (ritmo < KM_PER_DAY_MIN || ritmo > KM_PER_DAY_MAX) continue;

    ritmos.push(ritmo);
    if (ritmos.length === CICLOS_A_PROMEDIAR) break;
  }

  if (ritmos.length === 0) return fallback;
  return ritmos.reduce((a, b) => a + b, 0) / ritmos.length;
}
