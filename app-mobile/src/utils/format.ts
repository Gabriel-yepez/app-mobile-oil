// Formatos numéricos es-VE: miles con punto, decimales con coma.

export const fmtKm = (n: number): string =>
  Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');

/** Dos decimales con coma y miles con punto: 855.6625 → "855,66". */
export const fmtDecimal = (n: number): string =>
  n.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d),)/g, '.');

export const fmtUsd = (n: number): string => `$${fmtDecimal(n)}`;

export const fmtBs = (n: number): string => `Bs.S ${fmtKm(n)}`;

const MESES = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
];

/**
 * Fecha ISO → "08 feb 2026", el formato que ya usaba el mock.
 *
 * A mano y no con Intl: en Hermes el soporte de locales viene recortado según
 * cómo se compile la app, y "feb" tiene que decir feb en todos los teléfonos.
 * Se lee en UTC porque el backend guarda y devuelve en UTC.
 */
export const fmtFecha = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const dia = String(d.getUTCDate()).padStart(2, '0');
  return `${dia} ${MESES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};

const DIA_MS = 86_400_000;

/**
 * Cuánto pasó desde una fecha ISO: "hoy", "ayer", "hace 26d".
 *
 * Cuenta días de calendario, no bloques de 24 h: un cambio de anoche es
 * "ayer" aunque hayan pasado 10 horas. La fecha del cambio se lee en UTC
 * (como en fmtFecha, es la que guardó el backend) y "hoy" es el día del
 * teléfono, que es el que tiene en la cabeza quien lo mira.
 */
export const fmtHace = (iso: string, ahora = new Date()): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';

  const fecha = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const hoy = Date.UTC(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
  const dias = Math.round((hoy - fecha) / DIA_MS);

  // Una fecha futura es un error de tipeo al registrar; no se muestra negativa.
  if (dias <= 0) return 'hoy';
  if (dias === 1) return 'ayer';
  return `hace ${dias}d`;
};

/**
 * El inverso de fmtFecha: "08 feb 2026" → ISO en UTC. `null` si no parsea.
 *
 * Existe porque el formulario deja escribir la fecha —registrar hoy un cambio
 * hecho la semana pasada es un caso real— y el backend recibe ISO. Sin este
 * inverso habría que volver el campo de solo lectura y perder esa capacidad.
 */
export const parseFecha = (texto: string): string | null => {
  const m = texto.trim().toLowerCase().match(/^(\d{1,2})\s+([a-záéíóú]{3})\w*\s+(\d{4})$/);
  if (!m) return null;

  const mes = MESES.indexOf(m[2]);
  if (mes === -1) return null;

  const dia = parseInt(m[1], 10);
  const anio = parseInt(m[3], 10);
  const d = new Date(Date.UTC(anio, mes, dia));
  // Rebota el 31 de febrero: Date lo desborda al 3 de marzo en silencio.
  if (d.getUTCDate() !== dia || d.getUTCMonth() !== mes) return null;

  return d.toISOString();
};
