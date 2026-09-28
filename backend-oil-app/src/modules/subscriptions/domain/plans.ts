// Los planes. Hay dos y solo dos: el gratis, con topes, y el pro, que es el
// único de pago y no tiene ninguno.
//
// Este archivo es la ÚNICA fuente de los topes: el servidor los aplica desde
// acá y la app los lee de GET /plans. Antes vivían en el mock de la app, que
// los mostraba sin que nadie los hiciera cumplir.

export type PlanId = 'FREE' | 'PRO';

export type Plan = {
  id: PlanId;
  name: string;
  /** Lo que se cobra por mes, en USD. 0 en el gratis. */
  priceUsd: number;
  /** `null` es sin tope — no 0 ni Infinity, que se confunden con "nada". */
  maxVehicles: number | null;
  /** Cambios de aceite por mes calendario, según la fecha del cambio. */
  maxChangesPerMonth: number | null;
  /**
   * Cuántos meses hacia atrás se ven en el historial. `null` es todo. Lo más
   * viejo se OCULTA, no se borra: si el usuario pasa a Pro, reaparece. Y solo
   * afecta lo que se lista: el medidor y el ritmo de uso siguen calculándose
   * con el historial completo.
   */
  historyMonths: number | null;
  /** Exportar el historial a PDF (lo genera la app). */
  exportPdf: boolean;
  /** Los mensajes a soporte llegan marcados para atenderse primero. */
  prioritySupport: boolean;
  /** Lo que se lista en la tarjeta del plan. */
  features: string[];
};

const MAX_VEHICULOS_GRATIS = 5;
const MAX_CAMBIOS_GRATIS = 10;
const MESES_HISTORIAL_GRATIS = 12;

export const PLANES: Record<PlanId, Plan> = {
  FREE: {
    id: 'FREE',
    name: 'Gratis',
    priceUsd: 0,
    maxVehicles: MAX_VEHICULOS_GRATIS,
    maxChangesPerMonth: MAX_CAMBIOS_GRATIS,
    historyMonths: MESES_HISTORIAL_GRATIS,
    exportPdf: false,
    prioritySupport: false,
    features: [
      // Salen de las mismas constantes que se aplican: si cambia un tope, la
      // tarjeta no puede seguir prometiendo el viejo.
      `Hasta ${MAX_VEHICULOS_GRATIS} vehículos`,
      `${MAX_CAMBIOS_GRATIS} cambios de aceite por mes`,
      `Historial de los últimos ${MESES_HISTORIAL_GRATIS} meses`,
      'Recordatorios de próximo cambio',
    ],
  },
  PRO: {
    id: 'PRO',
    name: 'Pro',
    priceUsd: 4,
    maxVehicles: null,
    maxChangesPerMonth: null,
    historyMonths: null,
    exportPdf: true,
    prioritySupport: true,
    features: [
      'Vehículos ilimitados',
      'Cambios de aceite ilimitados',
      'Historial completo, sin límite de tiempo',
      'Exportar el historial a PDF',
      'Soporte prioritario',
      'Recordatorios de próximo cambio',
    ],
  },
};

/** En el orden en que se muestran: el gratis primero. */
export const LISTA_PLANES: Plan[] = [PLANES.FREE, PLANES.PRO];

/** Lo que hay guardado del usuario. Sin fila, es el gratis. */
export type SubscriptionRecord = {
  plan: PlanId;
  /** Hasta cuándo está pagado. null = sin vencimiento (otorgado a mano). */
  expiresAt: Date | null;
};

export type PlanEfectivo = {
  /** El plan cuyos topes se aplican HOY. */
  plan: Plan;
  /** El que tiene contratado, aunque esté vencido. */
  contratado: PlanId;
  status: 'active' | 'expired';
  expiresAt: Date | null;
};

/**
 * El plan que rige ahora. Un pro vencido no pierde nada de lo que tiene: solo
 * vuelve a los topes del gratis hasta que renueve.
 */
export function planEfectivo(
  sub: SubscriptionRecord | null,
  now: Date,
): PlanEfectivo {
  if (!sub || sub.plan === 'FREE') {
    return {
      plan: PLANES.FREE,
      contratado: 'FREE',
      status: 'active',
      expiresAt: null,
    };
  }

  const vencido = sub.expiresAt !== null && sub.expiresAt <= now;
  return {
    plan: vencido ? PLANES.FREE : PLANES[sub.plan],
    contratado: sub.plan,
    status: vencido ? 'expired' : 'active',
    expiresAt: sub.expiresAt,
  };
}

/**
 * El mes calendario que contiene `d`, en UTC: la misma zona en que se guardan
 * las fechas de los cambios, así un cambio cae en el mes que dice su fecha.
 */
export function mesDe(d: Date): { desde: Date; hasta: Date } {
  return {
    desde: new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)),
    hasta: new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)),
  };
}
