// El vehículo como lo entiende el negocio. Sin tipos de Prisma, igual que
// users/domain/user.ts.
export const VEHICLE_REPOSITORY = Symbol('VEHICLE_REPOSITORY');

export type VehicleKind = 'CAR' | 'MOTO';
export type KmRateSource = 'DECLARED' | 'MEASURED';

export type Vehicle = {
  id: string;
  userId: string;
  kind: VehicleKind;
  brand: string;
  model: string;
  year: number;
  plate: string;
  color: string;
  kmPerDay: number;
  kmPerDaySource: KmRateSource;
  lastChangeKm: number | null;
  lastChangeAt: Date | null;
  nextChangeKm: number | null;
  nextChangeDueAt: Date | null;
  /** Hasta cuándo está pospuesta la alerta del aceite; null si no lo está. */
  alertSnoozedUntil: Date | null;
};

/** Lo que hace falta para crear uno: el id y el espejo del ciclo los pone el
 *  almacén y OilCycleService respectivamente. */
export type NewVehicle = Omit<
  Vehicle,
  | 'id'
  | 'kmPerDaySource'
  | 'lastChangeKm'
  | 'lastChangeAt'
  | 'nextChangeKm'
  | 'nextChangeDueAt'
  | 'alertSnoozedUntil'
>;

/** Lo único que OilCycleService puede escribir del espejo. */
export type CycleMirror = {
  lastChangeKm: number | null;
  lastChangeAt: Date | null;
  nextChangeKm: number | null;
  nextChangeDueAt: Date | null;
};

export interface VehicleRepository {
  findById(id: string): Promise<Vehicle | null>;
  findByUser(userId: string): Promise<Vehicle[]>;
  listAllIds(): Promise<string[]>;
  /** Todos los vehículos de todos los usuarios. Lo usa el barrido de push. */
  findAll(): Promise<Vehicle[]>;
  /** `id` opcional: lo genera la app para poder crear sin señal. */
  create(data: NewVehicle & { id?: string }): Promise<Vehicle>;
  findByPlate(userId: string, plate: string): Promise<Vehicle | null>;
  /** Solo lo llama OilCycleService. Ver la regla del escritor único. */
  updateCycleMirror(id: string, mirror: CycleMirror): Promise<void>;
  update(
    id: string,
    patch: Partial<Omit<NewVehicle, 'userId'>> & {
      kmPerDaySource?: KmRateSource;
    },
  ): Promise<Vehicle>;
  remove(id: string): Promise<void>;
  /** Pospone la alerta hasta `until`, o la reactiva con null. */
  setAlertSnooze(id: string, until: Date | null): Promise<Vehicle>;
  updateKmRate(
    id: string,
    kmPerDay: number,
    source: KmRateSource,
  ): Promise<void>;
}
