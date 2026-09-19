import { OilService } from './oil.service';
import { OilCycleService } from './oil-cycle.service';
import { InMemoryVehicleRepository } from './testing/in-memory-vehicle.repository';
import { InMemoryOilChangeRepository } from './testing/in-memory-oil-change.repository';
import { InMemoryOdometerRepository } from './testing/in-memory-odometer.repository';

const utc = (s: string) => new Date(s);

const cambio = (km: number, fecha: string) => ({
  changedAt: utc(fecha),
  km,
  intervalKm: 5_000,
  intervalMonths: 6,
  oilBrand: 'Pennzoil',
  oilTag: 'Platinum',
  oilViscosity: '5W-30',
  oilSynthetic: true,
  shop: 'Lubricentro El Rápido',
  costUsd: 32,
});

describe('registrar un cambio de aceite', () => {
  let service: OilService;
  let vehicles: InMemoryVehicleRepository;
  let odometer: InMemoryOdometerRepository;
  let vehicleId: string;

  beforeEach(async () => {
    vehicles = new InMemoryVehicleRepository();
    const changes = new InMemoryOilChangeRepository();
    odometer = new InMemoryOdometerRepository();
    service = new OilService(
      vehicles,
      changes,
      odometer,
      new OilCycleService(vehicles, changes),
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

  it('deja el espejo del ciclo actualizado', async () => {
    await service.registerOilChange(
      'u1',
      vehicleId,
      cambio(45_000, '2026-06-04T00:00:00Z'),
    );
    const v = (await vehicles.findById(vehicleId))!;
    expect(v.lastChangeKm).toBe(45_000);
    expect(v.nextChangeKm).toBe(50_000);
  });

  it('escribe también una lectura de odómetro con source OIL_CHANGE', async () => {
    await service.registerOilChange(
      'u1',
      vehicleId,
      cambio(45_000, '2026-06-04T00:00:00Z'),
    );
    const lectura = await odometer.findLatest(vehicleId);
    expect(lectura).toMatchObject({ km: 45_000, source: 'OIL_CHANGE' });
  });

  it('rechaza un km menor que el del cambio anterior', async () => {
    await service.registerOilChange(
      'u1',
      vehicleId,
      cambio(45_000, '2026-06-04T00:00:00Z'),
    );
    await expect(
      service.registerOilChange(
        'u1',
        vehicleId,
        cambio(44_000, '2026-09-04T00:00:00Z'),
      ),
    ).rejects.toMatchObject({ response: { error: 'OIL_CHANGE_BACKWARDS' } });
  });

  it('no deja registrar en el vehículo de otro', async () => {
    await expect(
      service.registerOilChange(
        'u2',
        vehicleId,
        cambio(45_000, '2026-06-04T00:00:00Z'),
      ),
    ).rejects.toMatchObject({ response: { error: 'VEHICLE_NOT_FOUND' } });
  });

  it('al corregir el km el espejo lo sigue', async () => {
    const c = await service.registerOilChange(
      'u1',
      vehicleId,
      cambio(48_000, '2026-06-04T00:00:00Z'),
    );
    await service.updateOilChange('u1', c.id, { km: 45_000 });

    const v = (await vehicles.findById(vehicleId))!;
    expect(v.lastChangeKm).toBe(45_000);
    expect(v.nextChangeKm).toBe(50_000);
  });

  it('al borrar el último cambio el espejo retrocede', async () => {
    await service.registerOilChange(
      'u1',
      vehicleId,
      cambio(42_000, '2026-02-24T00:00:00Z'),
    );
    const ultimo = await service.registerOilChange(
      'u1',
      vehicleId,
      cambio(45_000, '2026-06-04T00:00:00Z'),
    );

    await service.removeOilChange('u1', ultimo.id);

    expect((await vehicles.findById(vehicleId))!.lastChangeKm).toBe(42_000);
  });

  it('no deja borrar el cambio de un vehículo ajeno', async () => {
    const c = await service.registerOilChange(
      'u1',
      vehicleId,
      cambio(45_000, '2026-06-04T00:00:00Z'),
    );
    await expect(service.removeOilChange('u2', c.id)).rejects.toMatchObject({
      response: { error: 'VEHICLE_NOT_FOUND' },
    });
  });
});

describe('registrar un cambio con id del cliente', () => {
  let service: OilService;
  let changes: InMemoryOilChangeRepository;
  let odometer: InMemoryOdometerRepository;
  let vehicleId: string;
  const ID = '3f1c2b4a-0000-4000-8000-0000000000aa';

  beforeEach(async () => {
    const vehicles = new InMemoryVehicleRepository();
    changes = new InMemoryOilChangeRepository();
    odometer = new InMemoryOdometerRepository();
    service = new OilService(
      vehicles,
      changes,
      odometer,
      new OilCycleService(vehicles, changes),
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

  it('usa el id que manda la app', async () => {
    const c = await service.registerOilChange('u1', vehicleId, {
      ...cambio(45_000, '2026-06-04T00:00:00Z'),
      id: ID,
    });
    expect(c.id).toBe(ID);
  });

  it('el reintento NO abre un ciclo nuevo', async () => {
    // Registrar dos veces el mismo cambio significaría reiniciar la barra sin
    // que el usuario haya hecho nada: el peor síntoma de un reintento mal
    // manejado.
    const datos = { ...cambio(45_000, '2026-06-04T00:00:00Z'), id: ID };
    await service.registerOilChange('u1', vehicleId, datos);
    await service.registerOilChange('u1', vehicleId, datos);

    expect(await changes.findByVehicle(vehicleId)).toHaveLength(1);
  });

  it('el reintento tampoco duplica la lectura de odómetro', async () => {
    const datos = { ...cambio(45_000, '2026-06-04T00:00:00Z'), id: ID };
    await service.registerOilChange('u1', vehicleId, datos);
    await service.registerOilChange('u1', vehicleId, datos);

    const estado = await service.getOilStatus(
      'u1',
      vehicleId,
      new Date('2026-06-04T00:00:00Z'),
    );
    expect(estado.odometer?.km).toBe(45_000);
  });

  it('el cambio de un vehículo ajeno responde VEHICLE_NOT_FOUND', async () => {
    const datos = { ...cambio(45_000, '2026-06-04T00:00:00Z'), id: ID };
    await service.registerOilChange('u1', vehicleId, datos);
    await expect(
      service.registerOilChange('u2', vehicleId, datos),
    ).rejects.toMatchObject({ response: { error: 'VEHICLE_NOT_FOUND' } });
  });
});
