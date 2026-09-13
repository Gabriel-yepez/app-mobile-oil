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
