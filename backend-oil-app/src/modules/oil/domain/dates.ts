// Aritmética de fechas del dominio. Todo en UTC: la app se usa en Venezuela,
// pero el servidor no tiene por qué compartir su huso, y una barra que cambia
// de valor según dónde corra el proceso es imposible de depurar.

const MS_POR_DIA = 86_400_000;

/**
 * Suma meses de CALENDARIO. "6 meses" desde el 4 de junio es el 4 de diciembre,
 * no 180 días después — que caería el 1º y adelantaría el vencimiento.
 *
 * Si el día no existe en el mes destino (31 de enero + 1 mes), se recorta al
 * último día del mes: el desborde de JavaScript lo mandaría al 3 de marzo, que
 * es un mes y tres días.
 */
export function addMonths(date: Date, months: number): Date {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  const d = date.getUTCDate();

  // Día 0 del mes siguiente = último día del mes destino.
  const ultimoDelDestino = new Date(Date.UTC(y, m + months + 1, 0)).getUTCDate();

  return new Date(
    Date.UTC(
      y,
      m + months,
      Math.min(d, ultimoDelDestino),
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds(),
      date.getUTCMilliseconds(),
    ),
  );
}

/** Días fraccionales de `from` a `to`. Negativo si `to` ya pasó. */
export function daysBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / MS_POR_DIA;
}

export function isSameUtcDay(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}
