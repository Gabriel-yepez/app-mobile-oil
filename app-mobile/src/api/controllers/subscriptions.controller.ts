// Endpoints de /plans y /me/subscription. Un archivo por recurso.
//
// Solo lectura: cambiar de plan espera a los pagos.
import { ApiClient } from '../base';

export type PlanId = 'FREE' | 'PRO';

export type ApiPlan = {
  id: PlanId;
  name: string;
  /** Precio mensual en USD; 0 en el gratis. */
  priceUsd: number;
  /** `null` es sin tope — no 0 ni Infinity, que se confunden con "nada". */
  maxVehicles: number | null;
  /** Por mes calendario, según la fecha de cada cambio. */
  maxChangesPerMonth: number | null;
  features: string[];
};

export type ApiSubscription = {
  /** El plan cuyos topes rigen HOY. Un Pro vencido trae acá el gratis. */
  plan: ApiPlan;
  /** El contratado, aunque esté vencido. */
  subscribedPlan: PlanId;
  status: 'active' | 'expired';
  /** ISO. Hasta cuándo está pagado; null en el gratis o sin vencimiento. */
  expiresAt: string | null;
  usage: { vehicles: number; changesThisMonth: number };
};

class SubscriptionsController extends ApiClient {
  constructor() {
    // Sin prefijo: las dos rutas cuelgan de lugares distintos.
    super('');
  }

  planes(): Promise<ApiPlan[]> {
    return this.get<ApiPlan[]>('/plans', { auth: true });
  }

  mia(): Promise<ApiSubscription> {
    return this.get<ApiSubscription>('/me/subscription', { auth: true });
  }
}

export const subscriptionsController = new SubscriptionsController();
