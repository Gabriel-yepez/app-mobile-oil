import { gastoPorMes } from '../inversion';

const cambio = (changedAt: string, costUsd: number | null) => ({ changedAt, costUsd });

describe('gastoPorMes', () => {
  it('devuelve siempre los doce meses, en cero si no hay cambios', () => {
    expect(gastoPorMes([], 2026)).toEqual(Array(12).fill(0));
  });

  it('suma los cambios de un mismo mes', () => {
    const meses = gastoPorMes(
      [cambio('2026-02-08T00:00:00.000Z', 20), cambio('2026-02-20T00:00:00.000Z', 15.5)],
      2026,
    );
    expect(meses[1]).toBe(35.5);
  });

  it('deja fuera los cambios de otros años', () => {
    const meses = gastoPorMes(
      [cambio('2025-12-30T00:00:00.000Z', 40), cambio('2026-01-03T00:00:00.000Z', 10)],
      2026,
    );
    expect(meses[0]).toBe(10);
    expect(meses[11]).toBe(0);
  });

  it('un cambio sin costo cuenta como cero', () => {
    expect(gastoPorMes([cambio('2026-05-01T00:00:00.000Z', null)], 2026)[4]).toBe(0);
  });

  it('ubica el mes en UTC, igual que fmtFecha', () => {
    // El 31 ene a las 23:00 UTC es enero aunque en otro huso ya sea febrero:
    // la barra tiene que coincidir con la fecha que muestra la lista.
    const meses = gastoPorMes([cambio('2026-01-31T23:00:00.000Z', 12)], 2026);
    expect(meses[0]).toBe(12);
    expect(meses[1]).toBe(0);
  });

  it('ignora una fecha que no parsea', () => {
    expect(gastoPorMes([cambio('no es una fecha', 30)], 2026)).toEqual(Array(12).fill(0));
  });
});
