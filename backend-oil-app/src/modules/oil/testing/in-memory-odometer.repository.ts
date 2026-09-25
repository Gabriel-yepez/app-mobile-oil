import type {
  NewOdometerReading,
  OdometerRecord,
  OdometerRepository,
} from '../domain/odometer.repository';

export class InMemoryOdometerRepository implements OdometerRepository {
  private readonly rows = new Map<string, OdometerRecord>();
  private seq = 0;

  findLatest(vehicleId: string): Promise<OdometerRecord | null> {
    // Por readAt descendente, igual que Prisma: la base de la proyección es la
    // lectura más reciente, no la última insertada.
    return Promise.resolve(
      [...this.rows.values()]
        .filter((r) => r.vehicleId === vehicleId)
        .sort((a, b) => b.readAt.getTime() - a.readAt.getTime())[0] ?? null,
    );
  }

  create(data: NewOdometerReading): Promise<OdometerRecord> {
    const row: OdometerRecord = { ...data, id: `od${++this.seq}` };
    this.rows.set(row.id, row);
    return Promise.resolve(row);
  }
}
