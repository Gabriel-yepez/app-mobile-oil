// Frontera con Prisma. Entra y sale el tipo de DOMINIO: el mapeo se hace acá y
// no más arriba, que es lo que mantiene a los servicios ignorantes del motor.
import { Injectable } from '@nestjs/common';
import type { Vehicle as PrismaVehicle } from '@prisma/client';
import type {
  CycleMirror,
  KmRateSource,
  NewVehicle,
  Vehicle,
  VehicleRepository,
} from '../../modules/oil/domain/vehicle.repository';
import { PrismaService } from './prisma.service';

@Injectable()
export class PrismaVehicleRepository implements VehicleRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toDomain(row: PrismaVehicle): Vehicle {
    return {
      id: row.id,
      userId: row.userId,
      kind: row.kind,
      brand: row.brand,
      model: row.model,
      year: row.year,
      plate: row.plate,
      color: row.color,
      // Decimal de Prisma no es number: se convierte en la frontera y no más
      // arriba, para que el calculador reciba aritmética normal.
      kmPerDay: Number(row.kmPerDay),
      kmPerDaySource: row.kmPerDaySource,
      lastChangeKm: row.lastChangeKm,
      lastChangeAt: row.lastChangeAt,
      nextChangeKm: row.nextChangeKm,
      nextChangeDueAt: row.nextChangeDueAt,
    };
  }

  async findById(id: string): Promise<Vehicle | null> {
    const row = await this.prisma.vehicle.findUnique({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  async findByUser(userId: string): Promise<Vehicle[]> {
    const rows = await this.prisma.vehicle.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => this.toDomain(r));
  }

  async listAllIds(): Promise<string[]> {
    const rows = await this.prisma.vehicle.findMany({ select: { id: true } });
    return rows.map((r) => r.id);
  }

  async findByPlate(userId: string, plate: string): Promise<Vehicle | null> {
    const row = await this.prisma.vehicle.findUnique({
      where: { userId_plate: { userId, plate } },
    });
    return row ? this.toDomain(row) : null;
  }

  async create(data: NewVehicle & { id?: string }): Promise<Vehicle> {
    const row = await this.prisma.vehicle.create({ data });
    return this.toDomain(row);
  }

  async updateCycleMirror(id: string, mirror: CycleMirror): Promise<void> {
    await this.prisma.vehicle.update({ where: { id }, data: mirror });
  }

  async updateKmRate(
    id: string,
    kmPerDay: number,
    source: KmRateSource,
  ): Promise<void> {
    await this.prisma.vehicle.update({
      where: { id },
      data: { kmPerDay, kmPerDaySource: source },
    });
  }
}
