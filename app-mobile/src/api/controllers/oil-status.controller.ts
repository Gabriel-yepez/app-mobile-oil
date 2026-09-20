// Endpoints del estado del aceite. Un archivo por recurso, nombrado
// <recurso>.controller.ts.
import { ApiClient } from '../base';

export type OilStatusLevel = 'ok' | 'warn' | 'danger';
export type LimitedBy = 'km' | 'time';

export type Gauge = {
  /** Vida restante, ya recortada a [0, 100] por el backend. */
  pct: number;
  status: OilStatusLevel;
  /** Qué eje manda: decide si el centro del medidor muestra km o días. */
  limitedBy: LimitedBy;
  /** Sin recortar: el negativo significa que ya se pasó. */
  kmLeft: number;
  daysLeft: number;
};

export type Odometer = {
  km: number;
  /** 'estimated' se muestra con tilde y es tocable para corregirlo. */
  source: 'reported' | 'estimated';
  asOf: string;
};

export type Cycle = {
  lastChangeKm: number | null;
  lastChangeAt: string | null;
  nextChangeKm: number | null;
  nextChangeDueAt: string | null;
  intervalKm: number;
  intervalMonths: number;
};

export type Oil = {
  brand: string;
  tag: string;
  viscosity: string;
  synthetic: boolean;
};

export type OilStatusResponse = {
  vehicleId: string;
  /** Si tiene más de un día, la tarjeta lo marca como desactualizado en vez de
   *  fingir que el número es de ahora. */
  computedAt: string;
  /** null mientras el vehículo no tenga ningún cambio registrado. */
  gauge: Gauge | null;
  odometer: Odometer | null;
  cycle: Cycle | null;
  oil: Oil | null;
};

class OilStatusController extends ApiClient {
  constructor() {
    super('/vehicles');
  }

  // Se llama `status` y no `get` porque `get` es el verbo protegido de
  // ApiClient: pisarlo rompería a todos los demás métodos del padre.
  status(vehicleId: string) {
    return this.get<OilStatusResponse>(`/${vehicleId}/oil-status`, {
      auth: true,
    });
  }

  /** Devuelve el bloque YA recalculado: no hace falta un GET después. */
  reportOdometer(vehicleId: string, km: number) {
    return this.post<OilStatusResponse>(`/${vehicleId}/odometer`, {
      auth: true,
      body: { km },
    });
  }
}

/** Instancia única: los controladores no guardan estado propio. */
export const oilStatusController = new OilStatusController();
