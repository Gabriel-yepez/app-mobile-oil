import { mesDe, PLANES, planEfectivo } from './plans';

const AHORA = new Date('2026-09-26T15:00:00.000Z');

describe('catálogo de planes', () => {
  it('el gratis tiene topes y el pro no tiene ninguno', () => {
    expect(PLANES.FREE).toMatchObject({
      maxVehicles: 5,
      maxChangesPerMonth: 10,
      priceUsd: 0,
    });
    expect(PLANES.PRO).toMatchObject({
      maxVehicles: null,
      maxChangesPerMonth: null,
    });
    expect(PLANES.PRO.priceUsd).toBeGreaterThan(0);
  });

  // El texto de la tarjeta sale de los mismos números que se aplican: subir un
  // tope no puede dejar la pantalla prometiendo el viejo.
  it('lo que lista el plan gratis dice los mismos topes que aplica', () => {
    expect(PLANES.FREE.features).toContain('Hasta 5 vehículos');
    expect(PLANES.FREE.features).toContain('10 cambios de aceite por mes');
  });
});

describe('planEfectivo', () => {
  it('sin suscripción guardada es el gratis, activo', () => {
    expect(planEfectivo(null, AHORA)).toEqual({
      plan: PLANES.FREE,
      contratado: 'FREE',
      status: 'active',
      expiresAt: null,
    });
  });

  it('un pro sin vencimiento es pro', () => {
    expect(planEfectivo({ plan: 'PRO', expiresAt: null }, AHORA).plan).toBe(
      PLANES.PRO,
    );
  });

  it('un pro vigente es pro y activo', () => {
    const r = planEfectivo(
      { plan: 'PRO', expiresAt: new Date('2026-10-14T00:00:00Z') },
      AHORA,
    );
    expect(r.plan).toBe(PLANES.PRO);
    expect(r.status).toBe('active');
  });

  // Vencido sin renovar: la cuenta sigue, con los topes del gratis. Lo que ya
  // tenía no se borra; solo no puede agregar más allá del tope.
  it('un pro vencido aplica los topes del gratis y dice que venció', () => {
    const r = planEfectivo(
      { plan: 'PRO', expiresAt: new Date('2026-09-01T00:00:00Z') },
      AHORA,
    );
    expect(r.plan).toBe(PLANES.FREE);
    expect(r.contratado).toBe('PRO');
    expect(r.status).toBe('expired');
  });
});

describe('mesDe', () => {
  it('va del primer día del mes al primero del siguiente, en UTC', () => {
    expect(mesDe(AHORA)).toEqual({
      desde: new Date('2026-09-01T00:00:00.000Z'),
      hasta: new Date('2026-10-01T00:00:00.000Z'),
    });
  });

  it('diciembre cierra en enero del año siguiente', () => {
    expect(mesDe(new Date('2026-12-31T10:00:00Z')).hasta).toEqual(
      new Date('2027-01-01T00:00:00.000Z'),
    );
  });
});
