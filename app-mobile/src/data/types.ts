// Espejo de los DTOs del backend. Se declara acá y no se importa del backend
// a propósito: son dos paquetes que se despliegan por separado, y un import
// cruzado los ataría a compilar juntos.
export type VehicleKind = 'CAR' | 'MOTO';

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
