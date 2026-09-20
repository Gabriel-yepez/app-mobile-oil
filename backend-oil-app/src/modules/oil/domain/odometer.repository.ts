export const ODOMETER_REPOSITORY = Symbol('ODOMETER_REPOSITORY');

export type ReadingSource = 'OIL_CHANGE' | 'MANUAL';

export type OdometerRecord = {
  id: string;
  vehicleId: string;
  km: number;
  readAt: Date;
  source: ReadingSource;
};

export type NewOdometerReading = Omit<OdometerRecord, 'id'>;

export interface OdometerRepository {
  findLatest(vehicleId: string): Promise<OdometerRecord | null>;
  create(data: NewOdometerReading): Promise<OdometerRecord>;
}
