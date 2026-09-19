import type {
  NewOilChange,
  OilChangeRecord,
  OilChangeRepository,
} from '../domain/oil-change.repository';

export class InMemoryOilChangeRepository implements OilChangeRepository {
  private readonly rows = new Map<string, OilChangeRecord>();
  private seq = 0;

  /**
   * Del más nuevo al más viejo: MISMO orden que Prisma. Si el doble ordenara
   * distinto, los tests pasarían y producción fallaría.
   */
  private ordenados(vehicleId: string): OilChangeRecord[] {
    return [...this.rows.values()]
      .filter((r) => r.vehicleId === vehicleId)
      .sort((a, b) => b.changedAt.getTime() - a.changedAt.getTime());
  }

  async findByVehicle(
    vehicleId: string,
    limit?: number,
  ): Promise<OilChangeRecord[]> {
    const all = this.ordenados(vehicleId);
    return limit ? all.slice(0, limit) : all;
  }

  async findLatest(vehicleId: string): Promise<OilChangeRecord | null> {
    return this.ordenados(vehicleId)[0] ?? null;
  }

  async findById(id: string): Promise<OilChangeRecord | null> {
    return this.rows.get(id) ?? null;
  }

  async create(data: NewOilChange & { id?: string }): Promise<OilChangeRecord> {
    const row: OilChangeRecord = { ...data, id: data.id ?? `oc${++this.seq}` };
    this.rows.set(row.id, row);
    return row;
  }

  async update(
    id: string,
    patch: Partial<NewOilChange>,
  ): Promise<OilChangeRecord> {
    const actual = this.rows.get(id);
    if (!actual) throw new Error(`cambio inexistente: ${id}`);
    const row = { ...actual, ...patch };
    this.rows.set(id, row);
    return row;
  }

  async remove(id: string): Promise<void> {
    this.rows.delete(id);
  }
}
