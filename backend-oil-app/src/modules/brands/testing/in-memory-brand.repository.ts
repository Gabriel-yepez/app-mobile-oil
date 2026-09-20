// Doble en memoria con las MISMAS garantías que el de Prisma, incluida la
// unicidad de (kind, nameKey). Si el doble deja pasar un duplicado, los tests
// del servicio pasan y producción falla.
import { randomUUID } from 'node:crypto';
import type {
  Brand,
  BrandRepository,
  NewBrand,
} from '../domain/brand.repository';
import type { VehicleKind } from '../../oil/domain/vehicle.repository';

export class InMemoryBrandRepository implements BrandRepository {
  readonly filas: Brand[] = [];

  /** Para sembrar en los tests sin pasar por createIfAbsent. */
  sembrar(kind: VehicleKind, name: string, nameKey: string): Brand {
    const brand: Brand = {
      id: randomUUID(),
      kind,
      name,
      nameKey,
      createdBy: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    this.filas.push(brand);
    return brand;
  }

  findByKind(kind: VehicleKind): Promise<Brand[]> {
    return Promise.resolve(
      this.filas
        .filter((b) => b.kind === kind)
        .sort((a, b) => a.name.localeCompare(b.name, 'es')),
    );
  }

  findById(id: string): Promise<Brand | null> {
    return Promise.resolve(this.filas.find((b) => b.id === id) ?? null);
  }

  findByKindAndKey(kind: VehicleKind, nameKey: string): Promise<Brand | null> {
    return Promise.resolve(
      this.filas.find((b) => b.kind === kind && b.nameKey === nameKey) ?? null,
    );
  }

  countCreatedBy(userId: string, desde: Date): Promise<number> {
    return Promise.resolve(
      this.filas.filter((b) => b.createdBy === userId && b.createdAt >= desde)
        .length,
    );
  }

  createIfAbsent(data: NewBrand): Promise<{ brand: Brand; created: boolean }> {
    const ya = this.filas.find(
      (b) => b.kind === data.kind && b.nameKey === data.nameKey,
    );
    if (ya) return Promise.resolve({ brand: ya, created: false });

    const brand: Brand = {
      id: data.id ?? randomUUID(),
      kind: data.kind,
      name: data.name,
      nameKey: data.nameKey,
      createdBy: data.createdBy,
      createdAt: new Date(),
    };
    this.filas.push(brand);
    return Promise.resolve({ brand, created: true });
  }
}
