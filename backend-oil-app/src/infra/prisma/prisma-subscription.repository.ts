// Frontera con Prisma para el módulo de suscripciones: el plan guardado y los
// conteos de consumo. Entra y sale el tipo de dominio.
import { Injectable } from '@nestjs/common';
import type { PlanUsageRepository } from '../../modules/subscriptions/domain/plan-usage.repository';
import type { SubscriptionRecord } from '../../modules/subscriptions/domain/plans';
import type { SubscriptionRepository } from '../../modules/subscriptions/domain/subscription.repository';
import { PrismaService } from './prisma.service';

@Injectable()
export class PrismaSubscriptionRepository implements SubscriptionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByUser(userId: string): Promise<SubscriptionRecord | null> {
    const row = await this.prisma.subscription.findUnique({
      where: { userId },
    });
    return row ? { plan: row.plan, expiresAt: row.expiresAt } : null;
  }
}

@Injectable()
export class PrismaPlanUsageRepository implements PlanUsageRepository {
  constructor(private readonly prisma: PrismaService) {}

  countVehicles(userId: string): Promise<number> {
    return this.prisma.vehicle.count({ where: { userId } });
  }

  // Un solo COUNT con join, no una consulta por vehículo.
  countOilChanges(userId: string, desde: Date, hasta: Date): Promise<number> {
    return this.prisma.oilChange.count({
      where: { vehicle: { userId }, changedAt: { gte: desde, lt: hasta } },
    });
  }
}
