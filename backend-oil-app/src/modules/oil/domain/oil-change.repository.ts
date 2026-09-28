export const OIL_CHANGE_REPOSITORY = Symbol('OIL_CHANGE_REPOSITORY');

export type OilChangeRecord = {
  id: string;
  vehicleId: string;
  changedAt: Date;
  km: number;
  intervalKm: number;
  intervalMonths: number;
  oilBrand: string;
  oilTag: string;
  oilViscosity: string;
  oilSynthetic: boolean;
  /** Texto libre del usuario. Null en los cambios viejos, que no lo tenían. */
  oilType: string | null;
  shop: string | null;
  costUsd: number | null;
};

// oilType es opcional al crear: la app vieja todavía no lo manda.
export type NewOilChange = Omit<OilChangeRecord, 'id' | 'oilType'> & {
  oilType?: string | null;
};

export type OilChangePage = {
  items: OilChangeRecord[];
  /** Id del último elemento devuelto, o null si no hay más páginas. */
  nextCursor: string | null;
};

export interface OilChangeRepository {
  /** Del más nuevo al más viejo. `limit` acota lo que baja de la base. */
  findByVehicle(vehicleId: string, limit?: number): Promise<OilChangeRecord[]>;
  findLatest(vehicleId: string): Promise<OilChangeRecord | null>;
  /** `since`: solo los de esa fecha en adelante (la ventana del plan). */
  findPage(
    vehicleId: string,
    opts: { cursor?: string; limit: number; since?: Date },
  ): Promise<OilChangePage>;
  /** Cuántos cambios tiene el vehículo con fecha anterior a `before`. */
  countBefore(vehicleId: string, before: Date): Promise<number>;
  findById(id: string): Promise<OilChangeRecord | null>;
  /** `id` opcional: lo genera la app para poder registrar sin señal. */
  create(data: NewOilChange & { id?: string }): Promise<OilChangeRecord>;
  update(id: string, patch: Partial<NewOilChange>): Promise<OilChangeRecord>;
  remove(id: string): Promise<void>;
}
