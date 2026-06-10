// Formatos numéricos es-VE: miles con punto, decimales con coma.

export const fmtKm = (n: number): string =>
  Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');

export const fmtUsd = (n: number): string =>
  `$${n.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d),)/g, '.')}`;

export const fmtBs = (n: number): string => `Bs.S ${fmtKm(n)}`;
