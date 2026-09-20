// Formatos numéricos es-VE: miles con punto, decimales con coma.

export const fmtKm = (n: number): string =>
  Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');

export const fmtUsd = (n: number): string =>
  `$${n.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d),)/g, '.')}`;

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
