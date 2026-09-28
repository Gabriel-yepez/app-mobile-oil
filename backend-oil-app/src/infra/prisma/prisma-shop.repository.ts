// Frontera con Prisma. Entra y sale el tipo de DOMINIO.
//
// Mismo esquema que PrismaBrandRepository: lock por usuario para el cupo y
// relectura fuera de la transacción si otro usuario ganó la carrera del
// índice único. Los comentarios de allá explican el porqué de cada paso.
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Shop as PrismaShop } from '@prisma/client';
import type {
  Cupo,
  NewShop,
  ResultadoAlta,
  Shop,
  ShopRepository,
} from '../../modules/shops/domain/shop.repository';
import { PrismaService } from './prisma.service';

const esDuplicado = (e: unknown): boolean =>
  e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';

@Injectable()
export class PrismaShopRepository implements ShopRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toDomain(row: PrismaShop): Shop {
    return {
      id: row.id,
      name: row.name,
      nameKey: row.nameKey,
      createdBy: row.createdBy,
      createdAt: row.createdAt,
    };
  }

  async findAll(): Promise<Shop[]> {
    const rows = await this.prisma.shop.findMany({ orderBy: { name: 'asc' } });
    return rows.map((r) => this.toDomain(r));
  }

  async createIfAbsent(data: NewShop, cupo: Cupo): Promise<ResultadoAlta> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        // Prefijo propio en la clave del lock: sin él, un alta de marca y una
        // de taller del mismo usuario se esperarían entre sí sin motivo.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`shop:${data.createdBy}`}))`;

        const porClave = await tx.shop.findUnique({
          where: { nameKey: data.nameKey },
        });
        if (porClave) return { shop: this.toDomain(porClave), created: false };

        if (data.id) {
          const porId = await tx.shop.findUnique({ where: { id: data.id } });
          if (porId) return { shop: this.toDomain(porId), created: false };
        }

        const creados = await tx.shop.count({
          where: { createdBy: data.createdBy, createdAt: { gte: cupo.desde } },
        });
        if (creados >= cupo.tope) return { limiteAlcanzado: true };

        const row = await tx.shop.create({
          data: {
            ...(data.id ? { id: data.id } : {}),
            name: data.name,
            nameKey: data.nameKey,
            createdBy: data.createdBy,
          },
        });
        return { shop: this.toDomain(row), created: true };
      });
    } catch (e) {
      if (!esDuplicado(e)) throw e;

      const ya = await this.prisma.shop.findUnique({
        where: { nameKey: data.nameKey },
      });
      const porId = data.id
        ? await this.prisma.shop.findUnique({ where: { id: data.id } })
        : null;
      const existente = ya ?? porId;
      if (!existente) throw e;
      return { shop: this.toDomain(existente), created: false };
    }
  }
}
