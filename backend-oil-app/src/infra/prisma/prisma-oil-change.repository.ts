// Frontera con Prisma. Entra y sale el tipo de DOMINIO.
import { Injectable } from '@nestjs/common';
import type { OilChange as PrismaOilChange } from '@prisma/client';
import type {
  NewOilChange,
  OilChangePage,
  OilChangeRecord,
  OilChangeRepository,
} from '../../modules/oil/domain/oil-change.repository';
import { PrismaService } from './prisma.service';

@Injectable()
export class PrismaOilChangeRepository implements OilChangeRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toDomain(row: PrismaOilChange): OilChangeRecord {
    return {
      id: row.id,
      vehicleId: row.vehicleId,
      changedAt: row.changedAt,
      km: row.km,
      intervalKm: row.intervalKm,
      intervalMonths: row.intervalMonths,
      oilBrand: row.oilBrand,
      oilTag: row.oilTag,
      oilViscosity: row.oilViscosity,
      oilSynthetic: row.oilSynthetic,
      shop: row.shop,
      costUsd: row.costUsd === null ? null : Number(row.costUsd),
    };
  }

  async findByVehicle(
    vehicleId: string,
    limit?: number,
  ): Promise<OilChangeRecord[]> {
    const rows = await this.prisma.oilChange.findMany({
      where: { vehicleId },
      // Del más nuevo al más viejo: es el orden que espera computeKmPerDay.
      orderBy: { changedAt: 'desc' },
      ...(limit ? { take: limit } : {}),
    });
    return rows.map((r) => this.toDomain(r));
  }

  async findLatest(vehicleId: string): Promise<OilChangeRecord | null> {
    const row = await this.prisma.oilChange.findFirst({
      where: { vehicleId },
      orderBy: { changedAt: 'desc' },
    });
    return row ? this.toDomain(row) : null;
  }

  /**
   * Paginado por cursor. Se piden `limit + 1` filas a propósito: si vuelven de
   * más, hay otra página — y así se evita un COUNT aparte sobre una tabla que
   * crece con cada cambio registrado.
   */
  async findPage(
    vehicleId: string,
    opts: { cursor?: string; limit: number },
  ): Promise<OilChangePage> {
    const rows = await this.prisma.oilChange.findMany({
      where: { vehicleId },
      orderBy: { changedAt: 'desc' },
      take: opts.limit + 1,
      ...(opts.cursor
        ? { cursor: { id: opts.cursor }, skip: 1 }
        : {}),
    });

    const hayMas = rows.length > opts.limit;
    const items = (hayMas ? rows.slice(0, opts.limit) : rows).map((r) =>
      this.toDomain(r),
    );
    return {
      items,
      nextCursor: hayMas ? (items.at(-1)?.id ?? null) : null,
    };
  }

  async findById(id: string): Promise<OilChangeRecord | null> {
    const row = await this.prisma.oilChange.findUnique({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  async create(data: NewOilChange & { id?: string }): Promise<OilChangeRecord> {
    const row = await this.prisma.oilChange.create({ data });
    return this.toDomain(row);
  }

  async update(
    id: string,
    patch: Partial<NewOilChange>,
  ): Promise<OilChangeRecord> {
    const row = await this.prisma.oilChange.update({
      where: { id },
      data: patch,
    });
    return this.toDomain(row);
  }

  async remove(id: string): Promise<void> {
    await this.prisma.oilChange.delete({ where: { id } });
  }
}
