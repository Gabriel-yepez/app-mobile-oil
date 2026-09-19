import { addMonths, daysBetween, isSameUtcDay } from './dates';

const utc = (s: string) => new Date(s);

describe('addMonths', () => {
  it('suma meses de calendario, no bloques de 30 días', () => {
    // 4 de junio + 6 meses es el 4 de diciembre, no el 1º.
    expect(addMonths(utc('2026-06-04T00:00:00Z'), 6).toISOString()).toBe(
      '2026-12-04T00:00:00.000Z',
    );
  });

  it('recorta al último día del mes cuando el día no existe', () => {
    // 31 de enero + 1 mes no es el 3 de marzo.
    expect(addMonths(utc('2026-01-31T00:00:00Z'), 1).toISOString()).toBe(
      '2026-02-28T00:00:00.000Z',
    );
  });

  it('respeta el febrero bisiesto', () => {
    expect(addMonths(utc('2028-01-31T00:00:00Z'), 1).toISOString()).toBe(
      '2028-02-29T00:00:00.000Z',
    );
  });

  it('cruza el año', () => {
    expect(addMonths(utc('2026-11-15T00:00:00Z'), 3).toISOString()).toBe(
      '2027-02-15T00:00:00.000Z',
    );
  });

  it('conserva la hora', () => {
    expect(addMonths(utc('2026-06-04T13:45:00Z'), 1).toISOString()).toBe(
      '2026-07-04T13:45:00.000Z',
    );
  });
});

describe('daysBetween', () => {
  it('devuelve días fraccionales', () => {
    expect(
      daysBetween(utc('2026-06-01T00:00:00Z'), utc('2026-06-02T12:00:00Z')),
    ).toBeCloseTo(1.5, 5);
  });

  it('devuelve negativo cuando la fecha destino ya pasó', () => {
    expect(
      daysBetween(utc('2026-06-10T00:00:00Z'), utc('2026-06-08T00:00:00Z')),
    ).toBeCloseTo(-2, 5);
  });
});

describe('isSameUtcDay', () => {
  it('es verdadero dentro del mismo día UTC', () => {
    expect(
      isSameUtcDay(utc('2026-06-04T00:10:00Z'), utc('2026-06-04T23:50:00Z')),
    ).toBe(true);
  });

  it('es falso cruzando la medianoche UTC', () => {
    expect(
      isSameUtcDay(utc('2026-06-04T23:59:00Z'), utc('2026-06-05T00:01:00Z')),
    ).toBe(false);
  });
});
