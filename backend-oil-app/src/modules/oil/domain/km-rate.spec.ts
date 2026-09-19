import { computeKmPerDay, type RateSample } from './km-rate';

const utc = (s: string) => new Date(s);

// Del más nuevo al más viejo, como los devuelve el repositorio.
const cambios = (...pares: [string, number][]): RateSample[] =>
  pares.map(([fecha, km]) => ({ changedAt: utc(fecha), km }));

describe('computeKmPerDay', () => {
  it('sin ciclos medibles devuelve el valor declarado', () => {
    expect(computeKmPerDay(cambios(['2026-06-04T00:00:00Z', 45_000]), 30)).toBe(
      30,
    );
  });

  it('con un ciclo mide el ritmo real', () => {
    // 3.000 km en 100 días = 30 km/día.
    const r = computeKmPerDay(
      cambios(
        ['2026-06-04T00:00:00Z', 45_000],
        ['2026-02-24T00:00:00Z', 42_000],
      ),
      99,
    );
    expect(r).toBeCloseTo(30, 2);
  });

  it('promedia los tres ciclos más recientes y descarta los viejos', () => {
    const r = computeKmPerDay(
      cambios(
        ['2026-06-04T00:00:00Z', 60_000], // 100 días, 4.000 km → 40
        ['2026-02-24T00:00:00Z', 56_000], // 100 días, 2.000 km → 20
        ['2025-11-16T00:00:00Z', 54_000], // 100 días, 3.000 km → 30
        ['2025-08-08T00:00:00Z', 51_000], // 100 días, 1.000 km → 10 (ignorado)
        ['2025-04-30T00:00:00Z', 50_000],
      ),
      99,
    );
    expect(r).toBeCloseTo(30, 0); // (40 + 20 + 30) / 3
  });

  it('descarta el ciclo con ritmo imposible por dedazo', () => {
    // 400.000 km en 100 días: alguien escribió un dígito de más.
    const r = computeKmPerDay(
      cambios(
        ['2026-06-04T00:00:00Z', 445_000],
        ['2026-02-24T00:00:00Z', 45_000],
        ['2025-11-16T00:00:00Z', 42_000], // 3.000 km en 100 días → 30
      ),
      99,
    );
    expect(r).toBeCloseTo(30, 0);
  });

  it('descarta el ciclo del vehículo que estuvo parado', () => {
    // 50 km en 200 días = 0,25 km/día: por debajo del piso.
    const r = computeKmPerDay(
      cambios(
        ['2026-06-04T00:00:00Z', 45_050],
        ['2025-11-16T00:00:00Z', 45_000],
        ['2025-08-08T00:00:00Z', 42_000], // 3.000 km en 100 días → 30
      ),
      99,
    );
    expect(r).toBeCloseTo(30, 0);
  });

  it('si TODOS los ciclos son inválidos cae al valor declarado', () => {
    const r = computeKmPerDay(
      cambios(
        ['2026-06-04T00:00:00Z', 445_000],
        ['2026-02-24T00:00:00Z', 45_000],
      ),
      37,
    );
    expect(r).toBe(37);
  });

  it('ignora dos cambios del mismo día en vez de dividir por cero', () => {
    const r = computeKmPerDay(
      cambios(
        ['2026-06-04T00:00:00Z', 45_100],
        ['2026-06-04T00:00:00Z', 45_000],
      ),
      25,
    );
    expect(r).toBe(25);
  });
});
