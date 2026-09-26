// Frontera con Prisma. Entra y sale el tipo de DOMINIO.
import { Injectable } from '@nestjs/common';
import type { OdometerReading as PrismaReading } from '@prisma/client';
import type {
  NewOdometerReading,
  OdometerRecord,
  OdometerRepository,
} from '../../modules/oil/domain/odometer.repository';
import { PrismaService } from './prisma.service';

@Injectable()
export class PrismaOdometerRepository implements OdometerRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toDomain(row: PrismaReading): OdometerRecord {
    return {
      id: row.id,
      vehicleId: row.vehicleId,
      km: row.km,
      readAt: row.readAt,
      source: row.source,
    };
  }

  async findLatest(vehicleId: string): Promise<OdometerRecord | null> {
    const row = await this.prisma.odometerReading.findFirst({
      where: { vehicleId },
      orderBy: { readAt: 'desc' },
    });
    return row ? this.toDomain(row) : null;
  }

  async create(data: NewOdometerReading): Promise<OdometerRecord> {
    const row = await this.prisma.odometerReading.create({ data });
    return this.toDomain(row);
  }
}
