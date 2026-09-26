import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import {
  InMemoryPlanUsageRepository,
  InMemorySubscriptionRepository,
} from '../subscriptions/testing/in-memory-subscriptions';
import { OilService } from './oil.service';
import { OilCycleService } from './oil-cycle.service';
import { InMemoryVehicleRepository } from './testing/in-memory-vehicle.repository';
import { InMemoryOilChangeRepository } from './testing/in-memory-oil-change.repository';
import { InMemoryOdometerRepository } from './testing/in-memory-odometer.repository';

const ficha = (plate: string, id?: string) => ({
  ...(id ? { id } : {}),
  kind: 'CAR' as const,
  brand: 'Toyota',
  model: 'Corolla',
  year: 2019,
  plate,
  color: '#111111',
  kmPerDay: 30,
});

const cambio = (id?: string) => ({
  ...(id ? { id } : {}),
  changedAt: new Date(),
  km: 45_000,
  intervalKm: 5_000,
  intervalMonths: 6,
  oilBrand: 'Pennzoil',
  oilTag: 'Platinum',
  oilViscosity: '5W-30',
  oilSynthetic: true,
  shop: null,
  costUsd: null,
});

describe('OilService aplica los topes del plan', () => {
  let service: OilService;
  let vehicles: InMemoryVehicleRepository;
  let changes: InMemoryOilChangeRepository;
  let odometer: InMemoryOdometerRepository;
  let uso: InMemoryPlanUsageRepository;

  beforeEach(() => {
    vehicles = new InMemoryVehicleRepository();
    changes = new InMemoryOilChangeRepository();
    odometer = new InMemoryOdometerRepository();
    uso = new InMemoryPlanUsageRepository();
    service = new OilService(
      vehicles,
      changes,
      odometer,
      new OilCycleService(vehicles, changes),
      { avisar: () => {} } as never,
      new SubscriptionsService(new InMemorySubscriptionRepository(), uso),
    );
  });

  it('con el cupo de vehículos lleno no crea nada', async () => {
    uso.vehiculos = 5;
    await expect(
      service.createVehicle('u1', ficha('AB123CD')),
    ).rejects.toMatchObject({
      response: { error: 'VEHICLE_LIMIT_REACHED' },
    });
    expect(await vehicles.findByUser('u1')).toHaveLength(0);
  });

  // El caso que trabaría la cola de la app: el servidor guardó, la respuesta
  // no llegó, y el reintento choca con un tope que ese mismo vehículo llenó.
  it('el reintento de un vehículo que ya existe pasa aunque el cupo esté lleno', async () => {
    await service.createVehicle('u1', ficha('AB123CD', 'veh-1'));
    uso.vehiculos = 5;
    const r = await service.createVehicleIdempotent(
      'u1',
      ficha('AB123CD', 'veh-1'),
    );
    expect(r.created).toBe(false);
  });

  it('con el cupo de cambios lleno no registra el cambio ni su lectura', async () => {
    const v = await service.createVehicle('u1', ficha('AB123CD'));
    const mes = new Date().toISOString().slice(0, 7);
    uso.cambiosPorMes.set(mes, 10);

    await expect(
      service.registerOilChange('u1', v.id, cambio()),
    ).rejects.toMatchObject({
      response: { error: 'OIL_CHANGE_LIMIT_REACHED' },
    });
    expect(await changes.findLatest(v.id)).toBeNull();
    expect(await odometer.findLatest(v.id)).toBeNull();
  });

  it('el reintento de un cambio que ya existe pasa aunque el cupo esté lleno', async () => {
    const v = await service.createVehicle('u1', ficha('AB123CD'));
    await service.registerOilChange('u1', v.id, cambio('oc-1'));
    uso.cambiosPorMes.set(new Date().toISOString().slice(0, 7), 10);

    const r = await service.registerOilChangeIdempotent(
      'u1',
      v.id,
      cambio('oc-1'),
    );
    expect(r.created).toBe(false);
  });
});
