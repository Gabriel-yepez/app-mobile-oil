import { OilService } from './oil.service';
import { OilCycleService } from './oil-cycle.service';
import { InMemoryVehicleRepository } from './testing/in-memory-vehicle.repository';
import { InMemoryOilChangeRepository } from './testing/in-memory-oil-change.repository';
import { InMemoryOdometerRepository } from './testing/in-memory-odometer.repository';

const nuevoVehiculo = {
  kind: 'CAR' as const,
  brand: 'Toyota',
  model: 'Corolla',
  year: 2019,
  plate: 'AB123CD',
  color: '#111111',
  kmPerDay: 30,
};

describe('OilService — alcance por usuario', () => {
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
    );
  });

  it('crea el vehículo con el ritmo declarado', async () => {
    const v = await service.createVehicle('u1', nuevoVehiculo);
    expect(v.kmPerDay).toBe(30);
    expect(v.kmPerDaySource).toBe('DECLARED');
  });

  it('lista solo los vehículos del usuario', async () => {
    await service.createVehicle('u1', nuevoVehiculo);
    await service.createVehicle('u2', { ...nuevoVehiculo, plate: 'XY999ZZ' });

    const mios = await service.listVehicles('u1');
    expect(mios).toHaveLength(1);
    expect(mios[0].plate).toBe('AB123CD');
  });

  it('el vehículo de otro usuario responde VEHICLE_NOT_FOUND', async () => {
    const v = await service.createVehicle('u1', nuevoVehiculo);
    await expect(service.getOwnedVehicle('u2', v.id)).rejects.toMatchObject({
      response: { error: 'VEHICLE_NOT_FOUND' },
    });
  });

  it('un id inexistente responde VEHICLE_NOT_FOUND', async () => {
    await expect(
      service.getOwnedVehicle('u1', 'no-existe'),
    ).rejects.toMatchObject({ response: { error: 'VEHICLE_NOT_FOUND' } });
  });
});

describe('crear vehículo con id del cliente', () => {
  let service: OilService;
  const ID = '3f1c2b4a-0000-4000-8000-000000000001';

  beforeEach(() => {
    const vehicles = new InMemoryVehicleRepository();
    const changes = new InMemoryOilChangeRepository();
    const odometer = new InMemoryOdometerRepository();
    service = new OilService(
      vehicles,
      changes,
      odometer,
      new OilCycleService(vehicles, changes),
    );
  });

  it('usa el id que manda la app', async () => {
    const v = await service.createVehicle('u1', { ...nuevoVehiculo, id: ID });
    expect(v.id).toBe(ID);
  });

  it('el mismo id dos veces devuelve el existente, no duplica', async () => {
    // El caso real: la cola reintentó porque el envío se cortó DESPUÉS de que
    // el servidor guardó.
    const a = await service.createVehicle('u1', { ...nuevoVehiculo, id: ID });
    const b = await service.createVehicle('u1', {
      ...nuevoVehiculo,
      id: ID,
      brand: 'Otra',
    });

    expect(b.id).toBe(a.id);
    // No se modifica: si el cuerpo difiere, gana lo ya guardado. Para
    // cambiarlo está PATCH.
    expect(b.brand).toBe('Toyota');
    expect(await service.listVehicles('u1')).toHaveLength(1);
  });

  it('un id de OTRO usuario responde VEHICLE_NOT_FOUND', async () => {
    await service.createVehicle('u1', { ...nuevoVehiculo, id: ID });
    await expect(
      service.createVehicle('u2', { ...nuevoVehiculo, id: ID }),
    ).rejects.toMatchObject({ response: { error: 'VEHICLE_NOT_FOUND' } });
  });

  it('la matrícula repetida del mismo usuario responde PLATE_TAKEN', async () => {
    await service.createVehicle('u1', nuevoVehiculo);
    await expect(
      service.createVehicle('u1', { ...nuevoVehiculo }),
    ).rejects.toMatchObject({ response: { error: 'PLATE_TAKEN' } });
  });

  it('la misma matrícula en OTRO usuario sí se permite', async () => {
    await service.createVehicle('u1', nuevoVehiculo);
    const v = await service.createVehicle('u2', nuevoVehiculo);
    expect(v.plate).toBe(nuevoVehiculo.plate);
  });
});
