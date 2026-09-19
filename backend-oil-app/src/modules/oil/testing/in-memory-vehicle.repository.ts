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

  async findById(id: string): Promise<Vehicle | null> {
    return this.rows.get(id) ?? null;
  }

  async findByUser(userId: string): Promise<Vehicle[]> {
    return [...this.rows.values()].filter((v) => v.userId === userId);
  }

  async listAllIds(): Promise<string[]> {
    return [...this.rows.keys()];
  }

  async findByPlate(userId: string, plate: string): Promise<Vehicle | null> {
    return (
      [...this.rows.values()].find(
        (v) => v.userId === userId && v.plate === plate,
      ) ?? null
    );
  }

  async create(data: NewVehicle & { id?: string }): Promise<Vehicle> {
    const row: Vehicle = {
      ...data,
      id: data.id ?? `v${++this.seq}`,
      kmPerDaySource: 'DECLARED',
      lastChangeKm: null,
      lastChangeAt: null,
      nextChangeKm: null,
      nextChangeDueAt: null,
    };
    this.rows.set(row.id, row);
    return row;
  }

  async updateCycleMirror(id: string, mirror: CycleMirror): Promise<void> {
    const row = this.rows.get(id);
    if (row) this.rows.set(id, { ...row, ...mirror });
  }

  async updateKmRate(
    id: string,
    kmPerDay: number,
    source: KmRateSource,
  ): Promise<void> {
    const row = this.rows.get(id);
    if (row) this.rows.set(id, { ...row, kmPerDay, kmPerDaySource: source });
  }
}
