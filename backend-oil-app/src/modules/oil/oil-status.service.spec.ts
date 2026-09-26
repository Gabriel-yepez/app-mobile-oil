import { SIN_TOPES } from '../subscriptions/testing/in-memory-subscriptions';
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
  shop: null,
  costUsd: null,
});

describe('bloque de estado del aceite', () => {
  let service: OilService;
  let vehicleId: string;

  beforeEach(async () => {
    const vehicles = new InMemoryVehicleRepository();
    const changes = new InMemoryOilChangeRepository();
    const odometer = new InMemoryOdometerRepository();
    service = new OilService(
      vehicles,
      changes,
      odometer,
      new OilCycleService(vehicles, changes),
      // Este spec no mira los avisos: un notificador que no hace nada.
      { avisar: () => {} } as never,
      SIN_TOPES,
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

  it('arma el bloque completo desde el último cambio', async () => {
    await service.registerOilChange(
      'u1',
      vehicleId,
      cambio(45_000, '2026-06-04T00:00:00Z'),
    );

    const r = await service.getOilStatus(
      'u1',
      vehicleId,
      utc('2026-07-04T00:00:00Z'),
    );

    // 30 días a 30 km/día = 900 km proyectados.
    expect(r.odometer).toMatchObject({ km: 45_900, source: 'estimated' });
    expect(r.gauge).toMatchObject({ limitedBy: 'km', status: 'ok' });
    expect(r.cycle).toMatchObject({
      lastChangeKm: 45_000,
      nextChangeKm: 50_000,
      intervalKm: 5_000,
      intervalMonths: 6,
    });
    expect(r.oil).toMatchObject({ brand: 'Pennzoil', viscosity: '5W-30' });
    expect(r.computedAt).toEqual(utc('2026-07-04T00:00:00Z'));
  });

  it('un vehículo sin cambios devuelve gauge, cycle y oil en null', async () => {
    const r = await service.getOilStatus(
      'u1',
      vehicleId,
      utc('2026-07-04T00:00:00Z'),
    );
    expect(r.gauge).toBeNull();
    expect(r.cycle).toBeNull();
    expect(r.oil).toBeNull();
    expect(r.odometer).toBeNull();
  });

  it('no devuelve el estado de un vehículo ajeno', async () => {
    await expect(
      service.getOilStatus('u2', vehicleId, utc('2026-07-04T00:00:00Z')),
    ).rejects.toMatchObject({ response: { error: 'VEHICLE_NOT_FOUND' } });
  });
});

describe('reportar el odómetro', () => {
  let service: OilService;
  let vehicleId: string;

  beforeEach(async () => {
    const vehicles = new InMemoryVehicleRepository();
    const changes = new InMemoryOilChangeRepository();
    const odometer = new InMemoryOdometerRepository();
    service = new OilService(
      vehicles,
      changes,
      odometer,
      new OilCycleService(vehicles, changes),
      // Este spec no mira los avisos: un notificador que no hace nada.
      { avisar: () => {} } as never,
      SIN_TOPES,
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
    await service.registerOilChange(
      'u1',
      vehicleId,
      cambio(45_000, '2026-06-04T00:00:00Z'),
    );
  });

  it('reancla la estimación y devuelve el bloque recalculado', async () => {
    const r = await service.reportOdometer(
      'u1',
      vehicleId,
      47_250,
      utc('2026-07-04T00:00:00Z'),
    );
    expect(r.odometer).toMatchObject({ km: 47_250, source: 'reported' });
    expect(r.gauge?.kmLeft).toBe(2_750);
  });

  it('rechaza una lectura menor que la última', async () => {
    await expect(
      service.reportOdometer(
        'u1',
        vehicleId,
        44_000,
        utc('2026-07-04T00:00:00Z'),
      ),
    ).rejects.toMatchObject({ response: { error: 'ODOMETER_BACKWARDS' } });
  });

  it('rechaza un salto imposible', async () => {
    // 30 días después: más de 500 km/día es un dígito de más.
    await expect(
      service.reportOdometer(
        'u1',
        vehicleId,
        200_000,
        utc('2026-07-04T00:00:00Z'),
      ),
    ).rejects.toMatchObject({ response: { error: 'ODOMETER_IMPLAUSIBLE' } });
  });

  it('acepta el salto justo en el borde de 500 km/día', async () => {
    const r = await service.reportOdometer(
      'u1',
      vehicleId,
      45_000 + 500 * 30,
      utc('2026-07-04T00:00:00Z'),
    );
    expect(r.odometer?.km).toBe(60_000);
  });

  it('no deja reportar en el vehículo de otro', async () => {
    await expect(
      service.reportOdometer(
        'u2',
        vehicleId,
        46_000,
        utc('2026-07-04T00:00:00Z'),
      ),
    ).rejects.toMatchObject({ response: { error: 'VEHICLE_NOT_FOUND' } });
  });
});

describe('lista de vehículos con estado', () => {
  let service: OilService;

  beforeEach(() => {
    const vehicles = new InMemoryVehicleRepository();
    const changes = new InMemoryOilChangeRepository();
    const odometer = new InMemoryOdometerRepository();
    service = new OilService(
      vehicles,
      changes,
      odometer,
      new OilCycleService(vehicles, changes),
      // Este spec no mira los avisos: un notificador que no hace nada.
      { avisar: () => {} } as never,
      SIN_TOPES,
    );
  });

  const ficha = (plate: string) => ({
    kind: 'CAR' as const,
    brand: 'Toyota',
    model: 'Corolla',
    year: 2019,
    plate,
    color: '#111111',
    kmPerDay: 30,
  });

  it('cada vehículo trae su gauge', async () => {
    const v = await service.createVehicle('u1', ficha('AB123CD'));
    await service.registerOilChange(
      'u1',
      v.id,
      cambio(45_000, '2026-06-04T00:00:00Z'),
    );

    const lista = await service.listVehiclesWithStatus(
      'u1',
      utc('2026-07-04T00:00:00Z'),
    );
    expect(lista[0].gauge).toMatchObject({ status: 'ok', limitedBy: 'km' });
    expect(lista[0].odometer?.source).toBe('estimated');
  });

  it('un vehículo sin ciclo trae gauge en null y no rompe la lista', async () => {
    await service.createVehicle('u1', ficha('AB123CD'));
    const lista = await service.listVehiclesWithStatus(
      'u1',
      utc('2026-07-04T00:00:00Z'),
    );
    expect(lista[0].gauge).toBeNull();
    expect(lista[0].odometer).toBeNull();
  });

  it('mezcla vehículos con y sin ciclo en la misma lista', async () => {
    const con = await service.createVehicle('u1', ficha('AB123CD'));
    await service.createVehicle('u1', ficha('XY999ZZ'));
    await service.registerOilChange(
      'u1',
      con.id,
      cambio(45_000, '2026-06-04T00:00:00Z'),
    );

    const lista = await service.listVehiclesWithStatus(
      'u1',
      utc('2026-07-04T00:00:00Z'),
    );
    expect(lista).toHaveLength(2);
    expect(lista.filter((v) => v.gauge !== null)).toHaveLength(1);
  });

  it('no incluye vehículos de otro usuario', async () => {
    await service.createVehicle('u1', ficha('AB123CD'));
    await service.createVehicle('u2', ficha('XY999ZZ'));

    const lista = await service.listVehiclesWithStatus(
      'u1',
      utc('2026-07-04T00:00:00Z'),
    );
    expect(lista).toHaveLength(1);
  });
});
