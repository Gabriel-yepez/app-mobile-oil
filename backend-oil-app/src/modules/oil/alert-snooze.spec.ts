import { OilService } from './oil.service';
import { OilCycleService } from './oil-cycle.service';
import { InMemoryVehicleRepository } from './testing/in-memory-vehicle.repository';
import { InMemoryOilChangeRepository } from './testing/in-memory-oil-change.repository';
import { InMemoryOdometerRepository } from './testing/in-memory-odometer.repository';

const AHORA = new Date('2026-09-26T15:00:00.000Z');

describe('posponer la alerta de un vehículo', () => {
  let service: OilService;
  let vehicles: InMemoryVehicleRepository;
  let avisos: string[];
  let vehicleId: string;

  beforeEach(async () => {
    vehicles = new InMemoryVehicleRepository();
    const changes = new InMemoryOilChangeRepository();
    avisos = [];
    service = new OilService(
      vehicles,
      changes,
      new InMemoryOdometerRepository(),
      new OilCycleService(vehicles, changes),
      { avisar: (u: string) => avisos.push(u) } as never,
    );
    const v = await service.createVehicle('u1', {
      kind: 'CAR',
      brand: 'Toyota',
      model: 'Corolla',
      year: 2019,
      plate: 'AB123CD',
      color: '#111111',
      kmPerDay: 30,
    });
    vehicleId = v.id;
  });

  it('un vehículo nuevo no tiene la alerta pospuesta', async () => {
    expect((await vehicles.findById(vehicleId))!.alertSnoozedUntil).toBeNull();
  });

  it('pospone por los días pedidos, contados desde ahora', async () => {
    const r = await service.snoozeAlert('u1', vehicleId, 3, AHORA);
    expect(r.alertSnoozedUntil).toEqual(new Date('2026-09-29T15:00:00.000Z'));
    expect((await vehicles.findById(vehicleId))!.alertSnoozedUntil).toEqual(
      new Date('2026-09-29T15:00:00.000Z'),
    );
  });

  // La respuesta es la ficha completa, con el medidor: la app la pone en la
  // lista tal cual, sin pedir la flota de nuevo.
  it('devuelve el vehículo con su estado calculado', async () => {
    const r = await service.snoozeAlert('u1', vehicleId, 1, AHORA);
    expect(r).toHaveProperty('gauge');
    expect(r.id).toBe(vehicleId);
  });

  it('no deja posponer la alerta de un vehículo ajeno', async () => {
    await expect(
      service.snoozeAlert('u2', vehicleId, 3, AHORA),
    ).rejects.toMatchObject({ response: { error: 'VEHICLE_NOT_FOUND' } });
  });

  it('reactivar la quita y avisa para que el barrido la reevalúe', async () => {
    await service.snoozeAlert('u1', vehicleId, 3, AHORA);
    const r = await service.unsnoozeAlert('u1', vehicleId, AHORA);
    expect(r.alertSnoozedUntil).toBeNull();
    expect(avisos).toContain('u1');
  });

  // Posponer es sobre el ciclo que se venció. El cambio abre uno nuevo, y
  // arrastrar el silencio podría callar una alerta que todavía no existe.
  it('registrar un cambio de aceite quita lo pospuesto', async () => {
    await service.snoozeAlert('u1', vehicleId, 7, AHORA);
    await service.registerOilChange('u1', vehicleId, {
      changedAt: AHORA,
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
    expect((await vehicles.findById(vehicleId))!.alertSnoozedUntil).toBeNull();
  });
});
