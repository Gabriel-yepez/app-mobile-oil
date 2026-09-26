// Dobles de prueba de los dos puertos del módulo.
import type { PlanUsageRepository } from '../domain/plan-usage.repository';
import type { SubscriptionRecord } from '../domain/plans';
import type { SubscriptionRepository } from '../domain/subscription.repository';

export class InMemorySubscriptionRepository implements SubscriptionRepository {
  readonly filas = new Map<string, SubscriptionRecord>();

  findByUser(userId: string): Promise<SubscriptionRecord | null> {
    return Promise.resolve(this.filas.get(userId) ?? null);
  }
}

/** Los conteos se fijan a mano: lo que se prueba es la regla, no el conteo. */
export class InMemoryPlanUsageRepository implements PlanUsageRepository {
  vehiculos = 0;
  /** Cambios por mes, con clave "2026-09". */
  cambiosPorMes = new Map<string, number>();

  countVehicles(): Promise<number> {
    return Promise.resolve(this.vehiculos);
  }

  countOilChanges(_userId: string, desde: Date): Promise<number> {
    const clave = desde.toISOString().slice(0, 7);
    return Promise.resolve(this.cambiosPorMes.get(clave) ?? 0);
  }
}

/** Para los specs que no miran los planes: todo cabe. */
export const SIN_TOPES = {
  asegurarCupoVehiculo: () => Promise.resolve(),
  asegurarCupoCambio: () => Promise.resolve(),
} as unknown as import('../subscriptions.service').SubscriptionsService;
