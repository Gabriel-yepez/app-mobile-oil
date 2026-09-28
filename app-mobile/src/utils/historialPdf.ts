// El HTML del historial que expo-print convierte en PDF. Puro: se prueba sin
// generar ningún archivo.
import { fmtFecha, fmtKm, fmtUsd } from './format';

export type FilaPdf = {
  /** ISO, como la devuelve el backend. */
  fecha: string;
  vehiculo: string;
  km: number;
  aceite: string;
  taller: string | null;
  costoUsd: number | null;
};

/** Lo que escribió el usuario (taller, aceite) no puede colarse como marcado. */
const esc = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export function htmlHistorial(d: {
  titular: string;
  generado: Date;
  filas: FilaPdf[];
}): string {
  const total = d.filas.reduce((s, f) => s + (f.costoUsd ?? 0), 0);
  const filas = d.filas
    .map(
      (f) => `<tr>
        <td class="mono">${fmtFecha(f.fecha)}</td>
        <td>${esc(f.vehiculo)}</td>
        <td class="mono num">${fmtKm(f.km)}</td>
        <td>${esc(f.aceite)}</td>
        <td>${f.taller ? esc(f.taller) : '—'}</td>
        <td class="mono num">${f.costoUsd === null ? '—' : fmtUsd(f.costoUsd)}</td>
      </tr>`,
    )
    .join('');

  // Estilos en línea: el PDF no carga nada de afuera, y las fuentes del
  // sistema alcanzan para una tabla.
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8" />
<style>
  body { font-family: -apple-system, Roboto, Helvetica, Arial, sans-serif; color: #0A2540; margin: 32px; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .sub { color: #64748B; font-size: 12px; margin-bottom: 20px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th { text-align: left; color: #64748B; font-weight: 600; border-bottom: 1.5px solid #0A2540; padding: 6px 4px; }
  td { border-bottom: 1px solid #E2E8F0; padding: 6px 4px; vertical-align: top; }
  .mono { font-family: Menlo, 'Courier New', monospace; }
  .num { text-align: right; white-space: nowrap; }
  tfoot td { border-bottom: none; font-weight: 700; padding-top: 10px; }
</style></head>
<body>
  <h1>Historial de cambios de aceite</h1>
  <div class="sub">${esc(d.titular)} · generado el ${fmtFecha(d.generado.toISOString())} · ${d.filas.length} ${d.filas.length === 1 ? 'cambio' : 'cambios'}</div>
  <table>
    <thead><tr><th>Fecha</th><th>Vehículo</th><th class="num">Km</th><th>Aceite</th><th>Taller</th><th class="num">Costo</th></tr></thead>
    <tbody>${filas}</tbody>
    <tfoot><tr><td colspan="5">Total invertido</td><td class="mono num">${fmtUsd(total)}</td></tr></tfoot>
  </table>
</body></html>`;
}
