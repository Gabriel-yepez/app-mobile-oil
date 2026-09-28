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

  @ApiProperty({
    nullable: true,
    example: 12,
    description:
      'Meses de historial visibles. `null` es todo. Lo anterior se oculta, no se borra.',
  })
  historyMonths!: number | null;

  @ApiProperty({ description: 'Puede exportar el historial a PDF.' })
  exportPdf!: boolean;

  @ApiProperty({ description: 'Sus mensajes a soporte se atienden primero.' })
  prioritySupport!: boolean;

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

export class SupportResponseDto {
  @ApiProperty({
    nullable: true,
    example: 'soporte@ejemplo.com',
    description:
      'A dónde escribir. `null` si el servidor no tiene soporte configurado: la app esconde el botón.',
  })
  email!: string | null;

  @ApiProperty({
    description:
      'Si el plan que rige incluye soporte prioritario. La app marca el asunto con [PRO].',
  })
  priority!: boolean;
}

export const toPlanResponse = (p: Plan): PlanResponseDto => ({
  id: p.id,
  name: p.name,
  priceUsd: p.priceUsd,
  maxVehicles: p.maxVehicles,
  maxChangesPerMonth: p.maxChangesPerMonth,
  historyMonths: p.historyMonths,
  exportPdf: p.exportPdf,
  prioritySupport: p.prioritySupport,
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
