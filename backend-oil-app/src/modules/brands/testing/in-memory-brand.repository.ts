// Doble en memoria con las MISMAS garantías que el de Prisma: unicidad de
// (kind, nameKey) y cupo aplicado junto con el alta. Si el doble deja pasar un
// duplicado o una marca de más, los tests del servicio pasan y producción
// falla.
//
// La atomicidad acá es gratis —JavaScript no interrumpe una función síncrona—,
// así que este doble NO puede demostrar que el lock del repositorio real
// funcione. Eso lo prueba el e2e con peticiones concurrentes.
import { randomUUID } from 'node:crypto';
import type {
  Brand,
  BrandRepository,
  Cupo,
  NewBrand,
  ResultadoAlta,
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

  createIfAbsent(data: NewBrand, cupo: Cupo): Promise<ResultadoAlta> {
    const porClave = this.filas.find(
      (b) => b.kind === data.kind && b.nameKey === data.nameKey,
    );
    if (porClave) return Promise.resolve({ brand: porClave, created: false });

    if (data.id) {
      const porId = this.filas.find((b) => b.id === data.id);
      if (porId) return Promise.resolve({ brand: porId, created: false });
    }

    const creadas = this.filas.filter(
      (b) => b.createdBy === data.createdBy && b.createdAt >= cupo.desde,
    ).length;
    if (creadas >= cupo.tope) return Promise.resolve({ limiteAlcanzado: true });

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
