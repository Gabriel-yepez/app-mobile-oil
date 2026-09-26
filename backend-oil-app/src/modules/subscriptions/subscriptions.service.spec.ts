import {
  InMemoryPlanUsageRepository,
  InMemorySubscriptionRepository,
} from './testing/in-memory-subscriptions';
import { SubscriptionsService } from './subscriptions.service';

const AHORA = new Date('2026-09-26T15:00:00.000Z');
const SEP = new Date('2026-09-10T00:00:00.000Z');
const AGO = new Date('2026-08-10T00:00:00.000Z');

function armar() {
  const subs = new InMemorySubscriptionRepository();
  const uso = new InMemoryPlanUsageRepository();
  return { subs, uso, service: new SubscriptionsService(subs, uso) };
}

describe('SubscriptionsService', () => {
  describe('estado', () => {
    it('trae el plan y lo consumido este mes', async () => {
      const { uso, service } = armar();
      uso.vehiculos = 3;
      uso.cambiosPorMes.set('2026-09', 4);
      uso.cambiosPorMes.set('2026-08', 9);

      const r = await service.estado('u1', AHORA);

      expect(r.plan.id).toBe('FREE');
      expect(r.usage).toEqual({ vehicles: 3, changesThisMonth: 4 });
    });
  });

  describe('tope de vehículos', () => {
    it('el gratis puede agregar mientras tenga menos de 5', async () => {
      const { uso, service } = armar();
      uso.vehiculos = 4;
      await expect(
        service.asegurarCupoVehiculo('u1', AHORA),
      ).resolves.toBeUndefined();
    });

    it('con 5, el gratis responde 403 VEHICLE_LIMIT_REACHED', async () => {
      const { uso, service } = armar();
      uso.vehiculos = 5;
      await expect(
        service.asegurarCupoVehiculo('u1', AHORA),
      ).rejects.toMatchObject({
        status: 403,
        response: { error: 'VEHICLE_LIMIT_REACHED' },
      });
    });

    it('el pro no tiene tope', async () => {
      const { subs, uso, service } = armar();
      subs.filas.set('u1', { plan: 'PRO', expiresAt: null });
      uso.vehiculos = 500;
      await expect(
        service.asegurarCupoVehiculo('u1', AHORA),
      ).resolves.toBeUndefined();
    });

    it('un pro vencido vuelve al tope del gratis', async () => {
      const { subs, uso, service } = armar();
      subs.filas.set('u1', {
        plan: 'PRO',
        expiresAt: new Date('2026-09-01T00:00:00Z'),
      });
      uso.vehiculos = 5;
      await expect(
        service.asegurarCupoVehiculo('u1', AHORA),
      ).rejects.toMatchObject({
        response: { error: 'VEHICLE_LIMIT_REACHED' },
      });
    });
  });

  describe('tope de cambios por mes', () => {
    it('con 10 cambios en septiembre, uno más de septiembre responde 403', async () => {
      const { uso, service } = armar();
      uso.cambiosPorMes.set('2026-09', 10);
      await expect(
        service.asegurarCupoCambio('u1', SEP, AHORA),
      ).rejects.toMatchObject({
        status: 403,
        response: { error: 'OIL_CHANGE_LIMIT_REACHED' },
      });
    });

    // El tope es por el mes de la FECHA del cambio: cargar el historial viejo
    // no gasta el cupo de este mes.
    it('un cambio fechado en agosto se mide contra agosto', async () => {
      const { uso, service } = armar();
      uso.cambiosPorMes.set('2026-09', 10);
      await expect(
        service.asegurarCupoCambio('u1', AGO, AHORA),
      ).resolves.toBeUndefined();
    });

    it('el pro no tiene tope', async () => {
      const { subs, uso, service } = armar();
      subs.filas.set('u1', { plan: 'PRO', expiresAt: null });
      uso.cambiosPorMes.set('2026-09', 80);
      await expect(
        service.asegurarCupoCambio('u1', SEP, AHORA),
      ).resolves.toBeUndefined();
    });
  });
});
