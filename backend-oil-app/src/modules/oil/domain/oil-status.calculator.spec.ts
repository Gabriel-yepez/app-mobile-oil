import { computeOilStatus } from './oil-status.calculator';
import type { OilStatusInput } from './oil-status';

const utc = (s: string) => new Date(s);

// Ciclo base: cambio el 4 de junio a los 45.000 km, 5.000 km / 6 meses.
// Límite por km: 50.000. Límite por tiempo: 4 de diciembre.
const cicloBase = {
  km: 45_000,
  changedAt: utc('2026-06-04T00:00:00Z'),
  intervalKm: 5_000,
  intervalMonths: 6,
};

const entrada = (over: Partial<OilStatusInput> = {}): OilStatusInput => ({
  now: utc('2026-07-04T00:00:00Z'),
  kmPerDay: 40,
  lastReading: { km: 45_000, readAt: utc('2026-06-04T00:00:00Z') },
  cycle: cicloBase,
  ...over,
});

describe('proyección del odómetro', () => {
  it('no proyecta nada si la lectura es de hoy', () => {
    const r = computeOilStatus(
      entrada({
        now: utc('2026-06-04T18:00:00Z'),
        lastReading: { km: 45_000, readAt: utc('2026-06-04T08:00:00Z') },
      }),
    );
    expect(r.odometer).toEqual({
      km: 45_000,
      source: 'reported',
      asOf: utc('2026-06-04T08:00:00Z'),
    });
  });

  it('proyecta 30 días a 40 km/día como 1.200 km', () => {
    const r = computeOilStatus(entrada());
    expect(r.odometer?.km).toBe(46_200);
    expect(r.odometer?.source).toBe('estimated');
  });

  it('el odómetro nunca baja', () => {
    // now anterior a la lectura (reloj torcido): no puede restar km.
    const r = computeOilStatus(entrada({ now: utc('2026-06-01T00:00:00Z') }));
    expect(r.odometer?.km).toBe(45_000);
  });

  it('deja asOf en la fecha de la lectura, no en now', () => {
    const r = computeOilStatus(entrada());
    expect(r.odometer?.asOf).toEqual(utc('2026-06-04T00:00:00Z'));
  });
});

describe('los dos ejes', () => {
  it('manda el km cuando el vehículo se usa mucho', () => {
    // 90 días a 50 km/día = 4.500 km. Quedan 500 km (10%) y ~3 meses (50%).
    const r = computeOilStatus(
      entrada({ now: utc('2026-09-02T00:00:00Z'), kmPerDay: 50 }),
    );
    expect(r.gauge?.limitedBy).toBe('km');
    expect(r.gauge?.kmLeft).toBe(500);
    expect(r.gauge?.pct).toBe(10);
    expect(r.gauge?.status).toBe('warn');
  });

  it('manda el tiempo cuando el vehículo está parado', () => {
    // 150 días a 2 km/día = 300 km. Sobran 4.700 km, pero faltan 33 días.
    const r = computeOilStatus(
      entrada({ now: utc('2026-11-01T00:00:00Z'), kmPerDay: 2 }),
    );
    expect(r.gauge?.limitedBy).toBe('time');
    expect(r.gauge?.kmLeft).toBe(4_700);
    expect(r.gauge?.daysLeft).toBe(33);
    expect(r.gauge?.pct).toBeLessThan(20);
  });

  it('kmLeft y daysLeft miden cada uno su eje, aunque solo uno mande', () => {
    const r = computeOilStatus(
      entrada({ now: utc('2026-11-01T00:00:00Z'), kmPerDay: 2 }),
    );
    expect(r.gauge?.kmLeft).toBeGreaterThan(0);
    expect(r.gauge?.daysLeft).toBeGreaterThan(0);
  });
});

describe('vencimiento', () => {
  it('vence por km: pct en 0, kmLeft negativo, danger', () => {
    // 120 días a 50 km/día = 6.000 km sobre 45.000 → 51.000, límite 50.000.
    const r = computeOilStatus(
      entrada({ now: utc('2026-10-02T00:00:00Z'), kmPerDay: 50 }),
    );
    expect(r.gauge?.pct).toBe(0);
    expect(r.gauge?.kmLeft).toBe(-1_000);
    expect(r.gauge?.status).toBe('danger');
    expect(r.gauge?.limitedBy).toBe('km');
  });

  it('vence por tiempo: pct en 0, daysLeft negativo, danger', () => {
    const r = computeOilStatus(
      entrada({ now: utc('2026-12-20T00:00:00Z'), kmPerDay: 1 }),
    );
    expect(r.gauge?.pct).toBe(0);
    expect(r.gauge?.daysLeft).toBeLessThan(0);
    expect(r.gauge?.status).toBe('danger');
    expect(r.gauge?.limitedBy).toBe('time');
  });

  it('el día del cambio la vida está llena', () => {
    const r = computeOilStatus(entrada({ now: utc('2026-06-04T00:00:00Z') }));
    expect(r.gauge?.pct).toBe(100);
    expect(r.gauge?.status).toBe('ok');
  });
});

describe('umbral de estado', () => {
  it('a mitad de ciclo está ok', () => {
    const r = computeOilStatus(
      entrada({ now: utc('2026-06-20T00:00:00Z'), kmPerDay: 40 }),
    );
    expect(r.gauge?.status).toBe('ok');
  });

  it('cerca del final pasa a warn', () => {
    const r = computeOilStatus(
      entrada({ now: utc('2026-08-20T00:00:00Z'), kmPerDay: 40 }),
    );
    expect(r.gauge?.status).toBe('warn');
  });

  it('no dice VENCIDO mientras quede vida, aunque pct redondee a 0', () => {
    // Vida cruda positiva pero mínima: pct baja a 0, el estado sigue en warn.
    const r = computeOilStatus(
      entrada({
        now: utc('2026-06-04T00:00:00Z'),
        lastReading: { km: 49_999, readAt: utc('2026-06-04T00:00:00Z') },
      }),
    );
    expect(r.gauge?.pct).toBe(0);
    expect(r.gauge?.status).toBe('warn');
  });
});

describe('sin datos', () => {
  it('sin ciclo devuelve gauge en null pero conserva el odómetro', () => {
    const r = computeOilStatus(entrada({ cycle: null }));
    expect(r.gauge).toBeNull();
    expect(r.odometer?.km).toBe(46_200);
  });

  it('sin lecturas devuelve todo en null', () => {
    const r = computeOilStatus(entrada({ lastReading: null, cycle: null }));
    expect(r.gauge).toBeNull();
    expect(r.odometer).toBeNull();
  });

  it('computedAt es el now que se le pasó', () => {
    const now = utc('2026-07-04T00:00:00Z');
    expect(computeOilStatus(entrada({ now })).computedAt).toEqual(now);
  });
});

describe('bordes del ritmo', () => {
  it.each([1, 500])('acepta %i km/día', (ritmo) => {
    const r = computeOilStatus(entrada({ kmPerDay: ritmo }));
    expect(r.odometer?.km).toBe(45_000 + ritmo * 30);
  });
});
