import { fmtFecha } from '../format';

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
