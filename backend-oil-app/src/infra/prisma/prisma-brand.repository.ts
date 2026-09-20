// Frontera con Prisma. Entra y sale el tipo de DOMINIO.
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Brand as PrismaBrand } from '@prisma/client';
import type {
  Brand,
  BrandRepository,
  Cupo,
  NewBrand,
  ResultadoAlta,
} from '../../modules/brands/domain/brand.repository';
import type { VehicleKind } from '../../modules/oil/domain/vehicle.repository';
import { PrismaService } from './prisma.service';

const esDuplicado = (e: unknown): boolean =>
  e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';

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

  async createIfAbsent(data: NewBrand, cupo: Cupo): Promise<ResultadoAlta> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        // Serializa las altas de ESTE usuario y de ningún otro. Sin el lock,
        // dos peticiones simultáneas cuentan cuatro cada una, las dos
        // concluyen que hay cupo y las dos insertan: el tope se salta con un
        // bucle en paralelo. El lock se suelta solo al cerrar la transacción.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${data.createdBy}))`;

        const porClave = await tx.brand.findUnique({
          where: { kind_nameKey: { kind: data.kind, nameKey: data.nameKey } },
        });
        if (porClave) {
          return { brand: this.toDomain(porClave), created: false };
        }

        if (data.id) {
          const porId = await tx.brand.findUnique({ where: { id: data.id } });
          if (porId) return { brand: this.toDomain(porId), created: false };
        }

        const creadas = await tx.brand.count({
          where: { createdBy: data.createdBy, createdAt: { gte: cupo.desde } },
        });
        if (creadas >= cupo.tope) return { limiteAlcanzado: true };

        const row = await tx.brand.create({
          data: {
            ...(data.id ? { id: data.id } : {}),
            kind: data.kind,
            name: data.name,
            nameKey: data.nameKey,
            createdBy: data.createdBy,
          },
        });
        return { brand: this.toDomain(row), created: true };
      });
    } catch (e) {
      // El lock serializa a un mismo usuario, no a dos distintos: A y B pueden
      // insertar "Chery" a la vez y uno choca contra el índice único. No es un
      // error — el resultado que quería ya existe.
      //
      // La relectura va FUERA de la transacción a propósito: en Postgres una
      // sentencia fallida envenena la transacción y no se puede seguir
      // consultando dentro de ella.
      if (!esDuplicado(e)) throw e;

      const ya = await this.prisma.brand.findUnique({
        where: { kind_nameKey: { kind: data.kind, nameKey: data.nameKey } },
      });
      const porId = data.id
        ? await this.prisma.brand.findUnique({ where: { id: data.id } })
        : null;
      const existente = ya ?? porId;
      if (!existente) throw e;
      return { brand: this.toDomain(existente), created: false };
    }
  }
}
