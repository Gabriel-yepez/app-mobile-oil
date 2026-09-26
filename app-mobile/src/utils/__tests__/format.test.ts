import { fmtDecimal, fmtFecha, fmtHace, fmtUsd, parseFecha } from '../format';

describe('fmtFecha', () => {
  it('formatea en es-VE corto', () => {
    expect(fmtFecha('2026-02-08T00:00:00.000Z')).toBe('08 feb 2026');
  });

  it('rellena el día con cero', () => {
    expect(fmtFecha('2026-11-05T00:00:00.000Z')).toBe('05 nov 2026');
  });

  it('lee en UTC, no en el huso del teléfono', () => {
    // A las 23:00 UTC sigue siendo el mismo día, aunque en Caracas ya sea otro
    // o al revés: la fecha del cambio es la que guardó el backend.
    expect(fmtFecha('2026-06-04T23:00:00.000Z')).toBe('04 jun 2026');
  });

  it('una fecha inválida no rompe la pantalla', () => {
    expect(fmtFecha('no es una fecha')).toBe('—');
  });
});

describe('parseFecha', () => {
  it('es el inverso exacto de fmtFecha', () => {
    const iso = '2026-02-08T00:00:00.000Z';
    expect(parseFecha(fmtFecha(iso))).toBe(iso);
  });

  it('acepta el día sin cero y el mes largo', () => {
    expect(parseFecha('8 febrero 2026')).toBe('2026-02-08T00:00:00.000Z');
  });

  it('rechaza un día que no existe en vez de desbordarlo', () => {
    // Date lo llevaría al 3 de marzo sin avisar.
    expect(parseFecha('31 feb 2026')).toBeNull();
  });

  it('rechaza texto que no es una fecha', () => {
    expect(parseFecha('mañana')).toBeNull();
    expect(parseFecha('')).toBeNull();
  });
});

describe('fmtDecimal', () => {
  it('redondea a dos decimales con coma', () => {
    expect(fmtDecimal(855.6625)).toBe('855,66');
  });

  it('separa los miles con punto', () => {
    expect(fmtDecimal(1234567.5)).toBe('1.234.567,50');
  });

  it('fmtUsd es el mismo número con el signo', () => {
    expect(fmtUsd(1234.5)).toBe('$1.234,50');
  });
});

describe('fmtHace', () => {
  // Las 20:00 del 26 sep en Caracas (UTC-4) ya son el 27 en UTC: "hoy" es el
  // día del teléfono, no el de Greenwich.
  const ahora = new Date(2026, 8, 26, 20, 0);

  it('el mismo día es "hoy"', () => {
    expect(fmtHace('2026-09-26T00:00:00.000Z', ahora)).toBe('hoy');
  });

  it('el día anterior es "ayer"', () => {
    expect(fmtHace('2026-09-25T00:00:00.000Z', ahora)).toBe('ayer');
  });

  it('más atrás cuenta los días', () => {
    expect(fmtHace('2026-08-31T00:00:00.000Z', ahora)).toBe('hace 26d');
  });

  it('cruza el cambio de año', () => {
    expect(fmtHace('2025-12-31T00:00:00.000Z', new Date(2026, 0, 2, 9, 0))).toBe('hace 2d');
  });

  // Registrar hoy un cambio con fecha de mañana es un error de tipeo, pero no
  // puede mostrarse como "hace -1d".
  it('una fecha futura se muestra como "hoy"', () => {
    expect(fmtHace('2026-09-28T00:00:00.000Z', ahora)).toBe('hoy');
  });

  it('una fecha inválida no rompe la pantalla', () => {
    expect(fmtHace('no es una fecha', ahora)).toBe('—');
  });
});
