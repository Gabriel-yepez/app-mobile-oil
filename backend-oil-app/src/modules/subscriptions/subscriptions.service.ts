// El plan del usuario y sus topes. Lo consulta OilService antes de crear un
// vehículo o registrar un cambio: los topes se aplican en el servidor, no en
// la pantalla, porque la API se puede llamar sin pasar por la app.
import { Inject, Injectable } from '@nestjs/common';
import { Errors } from '../../common/errors';
import {
  PLAN_USAGE_REPOSITORY,
  type PlanUsageRepository,
} from './domain/plan-usage.repository';
import { mesDe, planEfectivo, type PlanEfectivo } from './domain/plans';
import {
  SUBSCRIPTION_REPOSITORY,
  type SubscriptionRepository,
} from './domain/subscription.repository';

export type EstadoSuscripcion = PlanEfectivo & {
  usage: { vehicles: number; changesThisMonth: number };
};

@Injectable()
export class SubscriptionsService {
  constructor(
    @Inject(SUBSCRIPTION_REPOSITORY)
    private readonly subs: SubscriptionRepository,
    @Inject(PLAN_USAGE_REPOSITORY) private readonly uso: PlanUsageRepository,
  ) {}

  async planDe(userId: string, now = new Date()): Promise<PlanEfectivo> {
    return planEfectivo(await this.subs.findByUser(userId), now);
  }

  /** El plan con lo consumido: lo que muestran el perfil y la suscripción. */
  async estado(userId: string, now = new Date()): Promise<EstadoSuscripcion> {
    const { desde, hasta } = mesDe(now);
    const [efectivo, vehicles, changesThisMonth] = await Promise.all([
      this.planDe(userId, now),
      this.uso.countVehicles(userId),
      this.uso.countOilChanges(userId, desde, hasta),
    ]);
    return { ...efectivo, usage: { vehicles, changesThisMonth } };
  }

  async asegurarCupoVehiculo(userId: string, now = new Date()): Promise<void> {
    const { plan } = await this.planDe(userId, now);
    if (plan.maxVehicles === null) return;

    if ((await this.uso.countVehicles(userId)) >= plan.maxVehicles) {
      throw Errors.vehicleLimitReached(plan.name, plan.maxVehicles);
    }
  }

  /**
   * El tope es por mes calendario de la FECHA del cambio, no del día en que
   * se registra: así cargar el historial viejo de un vehículo recién dado de
   * alta no se come el cupo del mes en curso.
   */
  async asegurarCupoCambio(
    userId: string,
    changedAt: Date,
    now = new Date(),
  ): Promise<void> {
    const { plan } = await this.planDe(userId, now);
    if (plan.maxChangesPerMonth === null) return;

    const { desde, hasta } = mesDe(changedAt);
    if (
      (await this.uso.countOilChanges(userId, desde, hasta)) >=
      plan.maxChangesPerMonth
    ) {
      throw Errors.oilChangeLimitReached(plan.name, plan.maxChangesPerMonth);
    }
  }
}
