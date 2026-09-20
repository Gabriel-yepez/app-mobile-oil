import { OilCycleService } from './oil-cycle.service';
import { InMemoryVehicleRepository } from './testing/in-memory-vehicle.repository';
import { InMemoryOilChangeRepository } from './testing/in-memory-oil-change.repository';
import { addMonths } from './domain/dates';

const utc = (s: string) => new Date(s);

const fichaBase = {
  userId: 'u1',
  kind: 'CAR' as const,
  brand: 'Toyota',
  model: 'Corolla',
  year: 2019,
  plate: 'AB123CD',
  color: '#111111',
  kmPerDay: 30,
};

describe('espejo del ciclo vigente', () => {
  let vehicles: InMemoryVehicleRepository;
  let changes: InMemoryOilChangeRepository;
  let service: OilCycleService;
  let vehicleId: string;

  const cambio = (fecha: string, km: number) => ({
    vehicleId,
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

  /** La afirmación del invariante: las cuatro columnas == lo derivado. */
  const esperarEspejoCoherente = async () => {
    const v = (await vehicles.findById(vehicleId))!;
    const ultimo = await changes.findLatest(vehicleId);

    if (!ultimo) {
      expect(v.lastChangeKm).toBeNull();
      expect(v.lastChangeAt).toBeNull();
      expect(v.nextChangeKm).toBeNull();
      expect(v.nextChangeDueAt).toBeNull();
      return;
    }
    expect(v.lastChangeKm).toBe(ultimo.km);
    expect(v.lastChangeAt).toEqual(ultimo.changedAt);
    expect(v.nextChangeKm).toBe(ultimo.km + ultimo.intervalKm);
    expect(v.nextChangeDueAt).toEqual(
      addMonths(ultimo.changedAt, ultimo.intervalMonths),
    );
  };

  beforeEach(async () => {
    vehicles = new InMemoryVehicleRepository();
    changes = new InMemoryOilChangeRepository();
    service = new OilCycleService(vehicles, changes);
    vehicleId = (await vehicles.create(fichaBase)).id;
  });

  it('al registrar un cambio el espejo queda coherente', async () => {
    await changes.create(cambio('2026-06-04T00:00:00Z', 45_000));
    await service.syncVehicleCycle(vehicleId);
    await esperarEspejoCoherente();
  });

  it('al registrar un segundo cambio el espejo pasa al ciclo nuevo', async () => {
    await changes.create(cambio('2026-02-24T00:00:00Z', 42_000));
    await service.syncVehicleCycle(vehicleId);
    await changes.create(cambio('2026-06-04T00:00:00Z', 45_000));
    await service.syncVehicleCycle(vehicleId);

    expect((await vehicles.findById(vehicleId))!.lastChangeKm).toBe(45_000);
    await esperarEspejoCoherente();
  });

  it('al corregir el km del último cambio el espejo lo sigue', async () => {
    // El caso real: puso 48.000 y eran 45.000.
    const c = await changes.create(cambio('2026-06-04T00:00:00Z', 48_000));
    await service.syncVehicleCycle(vehicleId);

    await changes.update(c.id, { km: 45_000 });
    await service.syncVehicleCycle(vehicleId);

    const v = (await vehicles.findById(vehicleId))!;
    expect(v.lastChangeKm).toBe(45_000);
    expect(v.nextChangeKm).toBe(50_000);
    await esperarEspejoCoherente();
  });

  it('editar un cambio VIEJO no mueve el espejo', async () => {
    const viejo = await changes.create(cambio('2026-02-24T00:00:00Z', 42_000));
    await changes.create(cambio('2026-06-04T00:00:00Z', 45_000));
    await service.syncVehicleCycle(vehicleId);

    await changes.update(viejo.id, { km: 41_000 });
    await service.syncVehicleCycle(vehicleId);

    expect((await vehicles.findById(vehicleId))!.lastChangeKm).toBe(45_000);
    await esperarEspejoCoherente();
  });

  it('al borrar el último cambio el espejo RETROCEDE al anterior', async () => {
    await changes.create(cambio('2026-02-24T00:00:00Z', 42_000));
    const ultimo = await changes.create(cambio('2026-06-04T00:00:00Z', 45_000));
    await service.syncVehicleCycle(vehicleId);

    await changes.remove(ultimo.id);
    await service.syncVehicleCycle(vehicleId);

    expect((await vehicles.findById(vehicleId))!.lastChangeKm).toBe(42_000);
    await esperarEspejoCoherente();
  });

  it('al borrar el único cambio las cuatro columnas vuelven a null', async () => {
    const unico = await changes.create(cambio('2026-06-04T00:00:00Z', 45_000));
    await service.syncVehicleCycle(vehicleId);

    await changes.remove(unico.id);
    await service.syncVehicleCycle(vehicleId);

    await esperarEspejoCoherente();
  });

  it('con un solo cambio el ritmo sigue DECLARED: no hay nada medido', async () => {
    await changes.create(cambio('2026-06-04T00:00:00Z', 45_000));
    await service.syncVehicleCycle(vehicleId);

    const v = (await vehicles.findById(vehicleId))!;
    expect(v.kmPerDaySource).toBe('DECLARED');
    expect(v.kmPerDay).toBe(30);
  });

  it('recomputeAllCycles repara todos los vehículos', async () => {
    await changes.create(cambio('2026-06-04T00:00:00Z', 45_000));
    // Nadie llamó a sync: el espejo está desincronizado a propósito.
    expect((await vehicles.findById(vehicleId))!.lastChangeKm).toBeNull();

    expect(await service.recomputeAllCycles()).toBe(1);
    await esperarEspejoCoherente();
  });
});

describe('recalibración del ritmo', () => {
  it('con dos cambios medibles el ritmo pasa a MEASURED', async () => {
    const vehicles = new InMemoryVehicleRepository();
    const changes = new InMemoryOilChangeRepository();
    const service = new OilCycleService(vehicles, changes);
    const v = await vehicles.create({ ...fichaBase, kmPerDay: 99 });

    const base = {
      vehicleId: v.id,
      intervalKm: 5_000,
      intervalMonths: 6,
      oilBrand: 'Pennzoil',
      oilTag: 'Platinum',
      oilViscosity: '5W-30',
      oilSynthetic: true,
      shop: null,
      costUsd: null,
    };
    // 3.000 km en 100 días = 30 km/día.
    await changes.create({
      ...base,
      changedAt: utc('2026-02-24T00:00:00Z'),
      km: 42_000,
    });
    await changes.create({
      ...base,
      changedAt: utc('2026-06-04T00:00:00Z'),
      km: 45_000,
    });
    await service.syncVehicleCycle(v.id);

    const actualizado = (await vehicles.findById(v.id))!;
    expect(actualizado.kmPerDaySource).toBe('MEASURED');
    expect(actualizado.kmPerDay).toBeCloseTo(30, 0);
  });
});
