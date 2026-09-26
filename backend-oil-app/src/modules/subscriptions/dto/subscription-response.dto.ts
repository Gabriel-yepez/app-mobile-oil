import { ApiProperty } from '@nestjs/swagger';
import type { Plan } from '../domain/plans';
import type { EstadoSuscripcion } from '../subscriptions.service';

export class PlanResponseDto {
  @ApiProperty({ enum: ['FREE', 'PRO'] }) id!: 'FREE' | 'PRO';
  @ApiProperty({ example: 'Gratis' }) name!: string;
  @ApiProperty({ example: 0, description: 'Precio mensual en USD.' })
  priceUsd!: number;

  @ApiProperty({
    nullable: true,
    example: 5,
    description: '`null` es sin tope.',
  })
  maxVehicles!: number | null;

  @ApiProperty({
    nullable: true,
    example: 10,
    description:
      'Por mes calendario, según la fecha de cada cambio. `null` es sin tope.',
  })
  maxChangesPerMonth!: number | null;

  @ApiProperty({ type: [String] }) features!: string[];
}

class UsageDto {
  @ApiProperty({ example: 3 }) vehicles!: number;
  @ApiProperty({
    example: 4,
    description: 'Cambios con fecha en el mes en curso (UTC).',
  })
  changesThisMonth!: number;
}

export class SubscriptionResponseDto {
  @ApiProperty({
    type: PlanResponseDto,
    description:
      'El plan cuyos topes rigen hoy. Un Pro vencido trae acá el gratis.',
  })
  plan!: PlanResponseDto;

  @ApiProperty({
    enum: ['FREE', 'PRO'],
    description: 'El contratado, aunque esté vencido.',
  })
  subscribedPlan!: 'FREE' | 'PRO';

  @ApiProperty({ enum: ['active', 'expired'] }) status!: 'active' | 'expired';

  @ApiProperty({
    nullable: true,
    description:
      'Hasta cuándo está pagado. `null` en el gratis o sin vencimiento.',
  })
  expiresAt!: Date | null;

  @ApiProperty({ type: UsageDto }) usage!: UsageDto;
}

export const toPlanResponse = (p: Plan): PlanResponseDto => ({
  id: p.id,
  name: p.name,
  priceUsd: p.priceUsd,
  maxVehicles: p.maxVehicles,
  maxChangesPerMonth: p.maxChangesPerMonth,
  features: [...p.features],
});

export const toSubscriptionResponse = (
  e: EstadoSuscripcion,
): SubscriptionResponseDto => ({
  plan: toPlanResponse(e.plan),
  subscribedPlan: e.contratado,
  status: e.status,
  expiresAt: e.expiresAt,
  usage: e.usage,
});
