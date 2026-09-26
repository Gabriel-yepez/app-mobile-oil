jest.mock('../../api/controllers/subscriptions.controller', () => ({
  subscriptionsController: { planes: jest.fn(), mia: jest.fn() },
}));

import { subscriptionsController } from '../../api/controllers/subscriptions.controller';
import type { ApiPlan, ApiSubscription } from '../../api/controllers/subscriptions.controller';
import { quedaCupoCambio, quedaCupoVehiculo, useSuscripcion } from '../suscripcion';

const api = subscriptionsController as jest.Mocked<typeof subscriptionsController>;

const GRATIS: ApiPlan = {
  id: 'FREE',
  name: 'Gratis',
  priceUsd: 0,
  maxVehicles: 5,
  maxChangesPerMonth: 10,
  features: [],
};
const PRO: ApiPlan = { ...GRATIS, id: 'PRO', name: 'Pro', priceUsd: 4, maxVehicles: null, maxChangesPerMonth: null };

const sub = (plan: ApiPlan, vehicles = 0, changesThisMonth = 0): ApiSubscription => ({
  plan,
  subscribedPlan: plan.id,
  status: 'active',
  expiresAt: null,
  usage: { vehicles, changesThisMonth },
});

const AHORA = new Date('2026-09-26T15:00:00.000Z');

describe('useSuscripcion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useSuscripcion.setState({ planes: [], suscripcion: null });
  });

  it('trae el catálogo y la suscripción', async () => {
    api.planes.mockResolvedValue([GRATIS, PRO]);
    api.mia.mockResolvedValue(sub(GRATIS, 2, 3));

    await useSuscripcion.getState().cargar();

    expect(useSuscripcion.getState().planes).toEqual([GRATIS, PRO]);
    expect(useSuscripcion.getState().suscripcion?.usage.changesThisMonth).toBe(3);
  });

  it('sin red se queda con lo último conocido', async () => {
    useSuscripcion.setState({ planes: [GRATIS, PRO], suscripcion: sub(PRO) });
    api.planes.mockRejectedValue(new Error('sin red'));
    api.mia.mockRejectedValue(new Error('sin red'));

    await useSuscripcion.getState().cargar();

    expect(useSuscripcion.getState().suscripcion?.plan.id).toBe('PRO');
  });

  // Al cerrar sesión: quien entre después no puede ver el plan del anterior.
  it('limpiar lo deja sin suscripción', () => {
    useSuscripcion.setState({ planes: [GRATIS], suscripcion: sub(PRO) });
    useSuscripcion.getState().limpiar();
    expect(useSuscripcion.getState().suscripcion).toBeNull();
  });
});

describe('quedaCupoVehiculo', () => {
  it('el gratis con 4 puede agregar; con 5 no', () => {
    expect(quedaCupoVehiculo(sub(GRATIS), 4)).toBe(true);
    expect(quedaCupoVehiculo(sub(GRATIS), 5)).toBe(false);
  });

  it('el pro siempre puede', () => {
    expect(quedaCupoVehiculo(sub(PRO), 500)).toBe(true);
  });

  // Sin datos no se bloquea: el servidor es quien decide, y trabar al usuario
  // por no saber su plan sería peor que dejar que el servidor diga que no.
  it('sin suscripción cargada no bloquea', () => {
    expect(quedaCupoVehiculo(null, 50)).toBe(true);
  });
});

describe('quedaCupoCambio', () => {
  it('con 10 cambios este mes, uno de este mes no cabe', () => {
    expect(quedaCupoCambio(sub(GRATIS, 1, 10), '2026-09-26T00:00:00.000Z', AHORA)).toBe(false);
    expect(quedaCupoCambio(sub(GRATIS, 1, 9), '2026-09-26T00:00:00.000Z', AHORA)).toBe(true);
  });

  // Solo se sabe el uso del mes en curso. Uno de otro mes lo decide el servidor.
  it('un cambio de otro mes no se bloquea acá', () => {
    expect(quedaCupoCambio(sub(GRATIS, 1, 10), '2026-08-10T00:00:00.000Z', AHORA)).toBe(true);
  });

  it('el pro siempre puede', () => {
    expect(quedaCupoCambio(sub(PRO, 1, 99), '2026-09-26T00:00:00.000Z', AHORA)).toBe(true);
  });
});
