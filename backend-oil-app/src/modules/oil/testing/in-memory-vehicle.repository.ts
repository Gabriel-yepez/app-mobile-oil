// Doble de prueba del repositorio de vehículos. Mismo contrato que el de
// Prisma: si este se comportara distinto, los tests pasarían y producción no.
import type {
  CycleMirror,
  KmRateSource,
  NewVehicle,
  Vehicle,
  VehicleRepository,
} from '../domain/vehicle.repository';

export class InMemoryVehicleRepository implements VehicleRepository {
  private readonly rows = new Map<string, Vehicle>();
  private seq = 0;

  findById(id: string): Promise<Vehicle | null> {
    return Promise.resolve(this.rows.get(id) ?? null);
  }

  findByUser(userId: string): Promise<Vehicle[]> {
    return Promise.resolve(
      [...this.rows.values()].filter((v) => v.userId === userId),
    );
  }

  listAllIds(): Promise<string[]> {
    return Promise.resolve([...this.rows.keys()]);
  }

  findAll(): Promise<Vehicle[]> {
    return Promise.resolve([...this.rows.values()]);
  }

  findByPlate(userId: string, plate: string): Promise<Vehicle | null> {
    return Promise.resolve(
      [...this.rows.values()].find(
        (v) => v.userId === userId && v.plate === plate,
      ) ?? null,
    );
  }

  create(data: NewVehicle & { id?: string }): Promise<Vehicle> {
    const row: Vehicle = {
      ...data,
      id: data.id ?? `v${++this.seq}`,
      kmPerDaySource: 'DECLARED',
      lastChangeKm: null,
      lastChangeAt: null,
      nextChangeKm: null,
      nextChangeDueAt: null,
      alertSnoozedUntil: null,
    };
    this.rows.set(row.id, row);
    return Promise.resolve(row);
  }

  update(
    id: string,
    patch: Partial<Omit<NewVehicle, 'userId'>> & {
      kmPerDaySource?: KmRateSource;
    },
  ): Promise<Vehicle> {
    const actual = this.rows.get(id);
    // Promesa rechazada y no throw: el contrato es asíncrono y quien llame sin
    // await debe ver el fallo en la promesa, no como excepción síncrona.
    if (!actual) {
      return Promise.reject(new Error(`vehículo inexistente: ${id}`));
    }
    const row = { ...actual, ...patch };
    this.rows.set(id, row);
    return Promise.resolve(row);
  }

  setAlertSnooze(id: string, until: Date | null): Promise<Vehicle> {
    const actual = this.rows.get(id);
    if (!actual) {
      return Promise.reject(new Error(`vehículo inexistente: ${id}`));
    }
    const row = { ...actual, alertSnoozedUntil: until };
    this.rows.set(id, row);
    return Promise.resolve(row);
  }

  remove(id: string): Promise<void> {
    this.rows.delete(id);
    return Promise.resolve();
  }

  updateCycleMirror(id: string, mirror: CycleMirror): Promise<void> {
    const row = this.rows.get(id);
    if (row) this.rows.set(id, { ...row, ...mirror });
    return Promise.resolve();
  }

  updateKmRate(
    id: string,
    kmPerDay: number,
    source: KmRateSource,
  ): Promise<void> {
    const row = this.rows.get(id);
    if (row) this.rows.set(id, { ...row, kmPerDay, kmPerDaySource: source });
    return Promise.resolve();
  }
}
