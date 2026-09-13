import { Vehicle } from '../../data/mock';
import { buildSchedule, nextOccurrence } from '../plan';
import { DEFAULT_PREFS, NotifPrefs } from '../types';

const vehicle = (over: Partial<Vehicle> = {}): Vehicle => ({
  id: 'v1',
  kind: 'car',
  brand: 'Toyota',
  model: 'Corolla',
  year: 2019,
  plate: 'AB123CD',
  color: '#1E3A8A',
  km: 79_600,
  oil: { brand: 'Pennzoil', tag: 'Platinum', viscosity: '5W-30', synthetic: true },
  lastChange: 75_000,
  nextChange: 80_000, // kmLeft = 400 → 'warn'
  daysSince: 40,
  ...over,
});

const prefs = (over: Partial<NotifPrefs> = {}): NotifPrefs => ({ ...DEFAULT_PREFS, ...over });

const run = (vehicles: Vehicle[], p: NotifPrefs = prefs(), now = new Date('2026-09-12T07:00:00')) =>
  buildSchedule({ vehicles, prefs: p, permissionGranted: true, now });

describe('nextOccurrence', () => {
  it('usa hoy cuando la hora aún no ha pasado', () => {
    const now = new Date('2026-09-12T07:00:00');
    expect(new Date(nextOccurrence(now, 9)).toISOString()).toBe(
      new Date('2026-09-12T09:00:00').toISOString()
    );
  });

  it('salta al día siguiente cuando la hora ya pasó', () => {
    const now = new Date('2026-09-12T14:00:00');
    expect(new Date(nextOccurrence(now, 9)).toISOString()).toBe(
      new Date('2026-09-13T09:00:00').toISOString()
    );
  });
});

describe('buildSchedule — avisos de umbral', () => {
  it('no planifica nada para un vehículo por encima del umbral', () => {
    const out = run([vehicle({ nextChange: 80_101 })]); // kmLeft = 501
    expect(out.filter((n) => n.kind !== 'checkin')).toHaveLength(0);
  });

  it('planifica "warn" justo en el umbral (500 km)', () => {
    const out = run([vehicle({ nextChange: 80_100 })]); // kmLeft = 500
    const warn = out.find((n) => n.kind === 'warn');
    expect(warn?.id).toBe('oiltrack:oil-warn:v1');
    expect(warn?.body).toContain('500 km');
  });

  it('planifica "warn" con 1 km restante', () => {
    const out = run([vehicle({ nextChange: 79_601 })]); // kmLeft = 1
    expect(out.find((n) => n.kind === 'warn')).toBeDefined();
  });

  it('planifica "overdue" con 0 km restantes', () => {
    const out = run([vehicle({ nextChange: 79_600 })]); // kmLeft = 0
    expect(out.find((n) => n.kind === 'overdue')?.id).toBe('oiltrack:oil-overdue:v1');
  });

  it('planifica "overdue" y reporta los km pasados cuando es negativo', () => {
    const out = run([vehicle({ nextChange: 79_480 })]); // kmLeft = -120
    const overdue = out.find((n) => n.kind === 'overdue');
    expect(overdue?.body).toContain('120 km');
  });

  it('nunca planifica warn y overdue para el mismo vehículo', () => {
    const out = run([vehicle({ nextChange: 79_480 })]);
    expect(out.filter((n) => n.id.includes(':v1'))).toHaveLength(1);
  });

  it('entrega los avisos de umbral a las 9:00, no de inmediato', () => {
    const now = new Date('2026-09-12T14:00:00');
    const out = buildSchedule({
      vehicles: [vehicle()],
      prefs: prefs(),
      permissionGranted: true,
      now,
    });
    const warn = out.find((n) => n.kind === 'warn');
    expect(warn?.trigger).toEqual({
      type: 'date',
      date: new Date('2026-09-13T09:00:00').getTime(),
    });
  });

  it('usa el kilometraje en formato es-VE', () => {
    const out = run([vehicle({ km: 78_000, nextChange: 79_234 })]); // kmLeft = 1234 → sin aviso
    expect(out.filter((n) => n.kind !== 'checkin')).toHaveLength(0);
    const cerca = run([vehicle({ km: 78_000, nextChange: 78_400 })]); // kmLeft = 400
    expect(cerca.find((n) => n.kind === 'warn')?.body).toContain('400 km');
  });
});

describe('buildSchedule — recordatorio semanal', () => {
  it('planifica el check-in con el día y hora de las preferencias', () => {
    const out = run([], prefs({ checkinWeekday: 3, checkinHour: 20, checkinMinute: 30 }));
    const checkin = out.find((n) => n.kind === 'checkin');
    expect(checkin?.id).toBe('oiltrack:checkin-weekly');
    expect(checkin?.data).toEqual({ screen: 'Alerts' });
    expect(checkin?.trigger).toEqual({ type: 'weekly', weekday: 3, hour: 20, minute: 30 });
  });

  it('planifica el check-in aunque no haya ningún vehículo en riesgo', () => {
    const out = run([vehicle({ nextChange: 90_000 })]);
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe('checkin');
  });
});

describe('buildSchedule — compuertas', () => {
  it('devuelve plan vacío sin permiso', () => {
    const out = buildSchedule({
      vehicles: [vehicle()],
      prefs: prefs(),
      permissionGranted: false,
      now: new Date('2026-09-12T07:00:00'),
    });
    expect(out).toEqual([]);
  });

  it('devuelve plan vacío con el switch maestro apagado', () => {
    expect(run([vehicle()], prefs({ enabled: false }))).toEqual([]);
  });

  it('warnEnabled: false quita solo los avisos de próximo', () => {
    const out = run([vehicle()], prefs({ warnEnabled: false }));
    expect(out.find((n) => n.kind === 'warn')).toBeUndefined();
    expect(out.find((n) => n.kind === 'checkin')).toBeDefined();
  });

  it('overdueEnabled: false quita solo los avisos de vencido', () => {
    const out = run([vehicle({ nextChange: 79_000 })], prefs({ overdueEnabled: false }));
    expect(out.find((n) => n.kind === 'overdue')).toBeUndefined();
    expect(out.find((n) => n.kind === 'checkin')).toBeDefined();
  });

  it('un vencido con overdueEnabled: false no cae en warn', () => {
    const out = run([vehicle({ nextChange: 79_000 })], prefs({ overdueEnabled: false }));
    expect(out.find((n) => n.kind === 'warn')).toBeUndefined();
  });

  it('checkinEnabled: false quita solo el recordatorio', () => {
    const out = run([vehicle()], prefs({ checkinEnabled: false }));
    expect(out.find((n) => n.kind === 'checkin')).toBeUndefined();
    expect(out.find((n) => n.kind === 'warn')).toBeDefined();
  });

  it('respeta un umbral personalizado', () => {
    const out = run([vehicle()], prefs({ warnThresholdKm: 300 })); // kmLeft = 400
    expect(out.find((n) => n.kind === 'warn')).toBeUndefined();
  });
});

describe('buildSchedule — firma', () => {
  it('cambia la firma cuando cambia el kilometraje', () => {
    const a = run([vehicle()]).find((n) => n.kind === 'warn');
    const b = run([vehicle({ km: 79_800 })]).find((n) => n.kind === 'warn');
    expect(a?.id).toBe(b?.id);
    expect(a?.sig).not.toBe(b?.sig);
  });

  it('mantiene la firma cuando nada cambia', () => {
    const a = run([vehicle()]).find((n) => n.kind === 'warn');
    const b = run([vehicle()]).find((n) => n.kind === 'warn');
    expect(a?.sig).toBe(b?.sig);
  });
});
