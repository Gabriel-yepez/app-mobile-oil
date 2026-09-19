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
  shop: string | null;
  costUsd: number | null;
};

export type NewOilChange = Omit<OilChangeRecord, 'id'>;

export interface OilChangeRepository {
  /** Del más nuevo al más viejo. `limit` acota lo que baja de la base. */
  findByVehicle(vehicleId: string, limit?: number): Promise<OilChangeRecord[]>;
  findLatest(vehicleId: string): Promise<OilChangeRecord | null>;
  findById(id: string): Promise<OilChangeRecord | null>;
  create(data: NewOilChange): Promise<OilChangeRecord>;
  update(id: string, patch: Partial<NewOilChange>): Promise<OilChangeRecord>;
  remove(id: string): Promise<void>;
}
