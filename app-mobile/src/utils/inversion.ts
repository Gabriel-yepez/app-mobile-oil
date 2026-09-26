// Gasto en aceite agrupado por mes, para el gráfico de "Inversión" del
// Historial. Vive aparte de la pantalla para poder probarlo sin montar nada.

type ConCosto = { changedAt: string; costUsd: number | null };

/**
 * Los doce meses de `anio` con lo gastado en cada uno (USD). Siempre devuelve
 * doce posiciones —enero en 0— aunque no haya cambios: el gráfico dibuja el
 * año completo, no solo los meses con datos.
 *
 * El mes se lee en UTC por la misma razón que en fmtFecha: la fecha del cambio
 * es la que guardó el backend, y la barra tiene que caer en el mismo mes que
 * se lee en la lista.
 */
export function gastoPorMes(cambios: ConCosto[], anio: number): number[] {
  const meses = Array<number>(12).fill(0);
  for (const ch of cambios) {
    const d = new Date(ch.changedAt);
    if (Number.isNaN(d.getTime()) || d.getUTCFullYear() !== anio) continue;
    meses[d.getUTCMonth()] += ch.costUsd ?? 0;
  }
  return meses;
}
