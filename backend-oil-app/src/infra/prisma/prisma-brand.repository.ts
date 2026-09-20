// Frontera con Prisma. Entra y sale el tipo de DOMINIO.
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Brand as PrismaBrand } from '@prisma/client';
import type {
  Brand,
  BrandRepository,
  NewBrand,
} from '../../modules/brands/domain/brand.repository';
import type { VehicleKind } from '../../modules/oil/domain/vehicle.repository';
import { PrismaService } from './prisma.service';

@Injectable()
export class PrismaBrandRepository implements BrandRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toDomain(row: PrismaBrand): Brand {
    return {
      id: row.id,
      kind: row.kind,
      name: row.name,
      nameKey: row.nameKey,
      createdBy: row.createdBy,
      createdAt: row.createdAt,
    };
  }

  async findByKind(kind: VehicleKind): Promise<Brand[]> {
    const rows = await this.prisma.brand.findMany({
      where: { kind },
      orderBy: { name: 'asc' },
    });
    return rows.map((r) => this.toDomain(r));
  }

  async findById(id: string): Promise<Brand | null> {
    const row = await this.prisma.brand.findUnique({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  async findByKindAndKey(
    kind: VehicleKind,
    nameKey: string,
  ): Promise<Brand | null> {
    const row = await this.prisma.brand.findUnique({
      where: { kind_nameKey: { kind, nameKey } },
    });
    return row ? this.toDomain(row) : null;
  }

  async countCreatedBy(userId: string, desde: Date): Promise<number> {
    return this.prisma.brand.count({
      where: { createdBy: userId, createdAt: { gte: desde } },
    });
  }

  async createIfAbsent(
    data: NewBrand,
  ): Promise<{ brand: Brand; created: boolean }> {
    try {
      const row = await this.prisma.brand.create({
        data: {
          ...(data.id ? { id: data.id } : {}),
          kind: data.kind,
          name: data.name,
          nameKey: data.nameKey,
          createdBy: data.createdBy,
        },
      });
      return { brand: this.toDomain(row), created: true };
    } catch (e) {
      // P2002 = violación de índice único. Otra petición ganó la carrera
      // entre el chequeo del servicio y este insert. No es un error: el
      // resultado que el usuario quería ya existe.
      const esDuplicado =
        e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';
      if (!esDuplicado) throw e;

      const ya = await this.findByKindAndKey(data.kind, data.nameKey);
      // Si el duplicado fue por `id` y no por (kind, nameKey), hay que buscar
      // por id: si no, se devolvería null y el servicio reventaría con un
      // error peor que el original.
      const existente = ya ?? (data.id ? await this.findById(data.id) : null);
      if (!existente) throw e;
      return { brand: existente, created: false };
    }
  }
}
