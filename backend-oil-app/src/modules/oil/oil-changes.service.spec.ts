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
      // Este spec no mira los avisos: un notificador que no hace nada.
      { avisar: () => {} } as never,
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
      // Este spec no mira los avisos: un notificador que no hace nada.
      { avisar: () => {} } as never,
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

describe('historial del vehículo', () => {
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

    for (const [fecha, km] of [
      ['2025-06-04T00:00:00Z', 35_000],
      ['2025-12-04T00:00:00Z', 40_000],
      ['2026-06-04T00:00:00Z', 45_000],
    ] as [string, number][]) {
      await service.registerOilChange('u1', vehicleId, cambio(km, fecha));
    }
  });

  it('devuelve del más nuevo al más viejo', async () => {
    const { items } = await service.listOilChanges('u1', vehicleId);
    expect(items.map((c) => c.km)).toEqual([45_000, 40_000, 35_000]);
  });

  it('sin más páginas, nextCursor es null', async () => {
    const { nextCursor } = await service.listOilChanges('u1', vehicleId);
    expect(nextCursor).toBeNull();
  });

  it('pagina con cursor', async () => {
    const p1 = await service.listOilChanges('u1', vehicleId, { limit: 2 });
    expect(p1.items.map((c) => c.km)).toEqual([45_000, 40_000]);
    expect(p1.nextCursor).not.toBeNull();

    const p2 = await service.listOilChanges('u1', vehicleId, {
      limit: 2,
      cursor: p1.nextCursor!,
    });
    expect(p2.items.map((c) => c.km)).toEqual([35_000]);
    // La última página no ofrece otra: sin esto la app pagina para siempre.
    expect(p2.nextCursor).toBeNull();
  });

  it('recorta un limit desmedido en vez de bajar la tabla entera', async () => {
    const { items } = await service.listOilChanges('u1', vehicleId, {
      limit: 100_000,
    });
    expect(items).toHaveLength(3);
  });

  it('no devuelve el historial de un vehículo ajeno', async () => {
    await expect(service.listOilChanges('u2', vehicleId)).rejects.toMatchObject(
      { response: { error: 'VEHICLE_NOT_FOUND' } },
    );
  });
});

describe('alertas resueltas en el historial', () => {
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
      { avisar: () => {} } as never,
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

    // Ciclos de 5.000 km / 6 meses:
    //   35.000 → primer cambio, no había ciclo
    //   36.000 → adelantado, quedaba el 80%: no hubo alerta
    //   40.200 → quedaba el 16%: resolvió un warn
    //   45.600 → pasado el límite de km: resolvió un danger
    for (const [fecha, km] of [
      ['2025-01-10T00:00:00Z', 35_000],
      ['2025-02-10T00:00:00Z', 36_000],
      ['2025-05-10T00:00:00Z', 40_200],
      ['2025-08-10T00:00:00Z', 45_600],
    ] as [string, number][]) {
      await service.registerOilChange('u1', vehicleId, cambio(km, fecha));
    }
  });

  it('marca cada cambio con la alerta que atendió', async () => {
    const { items } = await service.listOilChanges('u1', vehicleId);
    expect(items.map((c) => [c.km, c.resolvedAlert])).toEqual([
      [45_600, 'danger'],
      [40_200, 'warn'],
      [36_000, null],
      [35_000, null],
    ]);
  });

  // El anterior del último de una página vive en la página siguiente: sin
  // buscarlo, el borde de cada página saldría siempre como "sin alerta".
  it('resuelve bien el último cambio de una página', async () => {
    const p1 = await service.listOilChanges('u1', vehicleId, { limit: 2 });
    expect(p1.items.map((c) => c.resolvedAlert)).toEqual(['danger', 'warn']);

    const p2 = await service.listOilChanges('u1', vehicleId, {
      limit: 1,
      cursor: p1.nextCursor!,
    });
    expect(p2.items[0].resolvedAlert).toBeNull();
  });

  it('el cambio recién registrado ya dice qué alerta resolvió', async () => {
    const r = await service.registerOilChange(
      'u1',
      vehicleId,
      cambio(51_000, '2025-11-10T00:00:00Z'),
    );
    // 5.400 de 5.000 km: estaba vencido.
    expect(r.resolvedAlert).toBe('danger');
  });

  it('al corregir el km se recalcula', async () => {
    const { items } = await service.listOilChanges('u1', vehicleId, {
      limit: 1,
    });
    const r = await service.updateOilChange('u1', items[0].id, { km: 41_000 });
    // 41.000 sobre el ciclo de 40.200: le quedaba casi todo.
    expect(r.resolvedAlert).toBeNull();
  });
});
