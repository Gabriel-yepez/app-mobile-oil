// Espejo de los DTOs del backend. Se declara acá y no se importa del backend
// a propósito: son dos paquetes que se despliegan por separado, y un import
// cruzado los ataría a compilar juntos.
/**
 * En minúsculas: es el vocabulario que ya hablan todos los componentes de la
 * app (VehicleThumb, los filtros del garaje, los formularios). El backend usa
 * mayúsculas y la conversión ocurre en el controlador de la API, igual que el
 * `toDomain` del backend convierte en SU frontera. Una sola forma adentro.
 */
export type VehicleKind = 'car' | 'moto';

export type NewVehicleInput = {
  kind: VehicleKind;
  brand: string;
  model: string;
  year: number;
  plate: string;
  color: string;
  /** Ritmo declarado, en km/día. El backend lo valida contra [1, 500]. */
  kmPerDay: number;
};

export type NewOilChangeInput = {
  changedAt: string;
  km: number;
  intervalKm: number;
  intervalMonths: number;
  oilBrand: string;
  oilTag: string;
  oilViscosity: string;
  oilSynthetic: boolean;
  shop?: string | null;
  costUsd?: number | null;
};
