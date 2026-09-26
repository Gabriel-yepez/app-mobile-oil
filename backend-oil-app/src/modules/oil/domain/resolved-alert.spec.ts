import { alertaResuelta } from './resolved-alert';

const utc = (s: string) => new Date(s);

// Ciclo anterior: 4 de junio a los 45.000 km, 5.000 km / 6 meses.
// Límite por km: 50.000. Límite por tiempo: 4 de diciembre.
const anterior = {
  km: 45_000,
  changedAt: utc('2026-06-04T00:00:00Z'),
  intervalKm: 5_000,
  intervalMonths: 6,
};

describe('alertaResuelta', () => {
  it('el primer cambio del vehículo no resuelve nada: no había ciclo', () => {
    expect(
      alertaResuelta(null, {
        km: 45_000,
        changedAt: utc('2026-06-04T00:00:00Z'),
      }),
    ).toBeNull();
  });

  // El caso que la lista mostraba mal: cambiar el aceite antes de tiempo no es
  // atender una alerta, porque nunca la hubo.
  it('un cambio adelantado, con vida de sobra, no resuelve ninguna alerta', () => {
    expect(
      alertaResuelta(anterior, {
        km: 47_000,
        changedAt: utc('2026-08-04T00:00:00Z'),
      }),
    ).toBeNull();
  });

  it('un cambio hecho con el aceite en la zona de aviso resuelve un warn', () => {
    // 4.000 de 5.000 km: queda el 20% de vida.
    expect(
      alertaResuelta(anterior, {
        km: 49_000,
        changedAt: utc('2026-08-04T00:00:00Z'),
      }),
    ).toBe('warn');
  });

  it('un cambio hecho pasado el límite de km resuelve un danger', () => {
    expect(
      alertaResuelta(anterior, {
        km: 50_800,
        changedAt: utc('2026-08-04T00:00:00Z'),
      }),
    ).toBe('danger');
  });

  // El carro parado: pocos km, pero pasaron más de 6 meses.
  it('un cambio hecho pasado el límite de tiempo también resuelve un danger', () => {
    expect(
      alertaResuelta(anterior, {
        km: 46_000,
        changedAt: utc('2027-01-10T00:00:00Z'),
      }),
    ).toBe('danger');
  });

  // El km del cambio es una medición real de ESE día: no se proyecta nada,
  // así que el ritmo de uso no puede torcer el resultado.
  it('no depende de ningún ritmo de uso: usa el km del cambio tal cual', () => {
    expect(
      alertaResuelta(anterior, {
        km: 45_100,
        changedAt: utc('2026-06-10T00:00:00Z'),
      }),
    ).toBeNull();
  });
});
