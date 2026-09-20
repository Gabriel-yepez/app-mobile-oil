// La marca como la entiende el negocio. Sin tipos de Prisma.
import type { VehicleKind } from '../../oil/domain/vehicle.repository';

export const BRAND_REPOSITORY = Symbol('BRAND_REPOSITORY');

export type Brand = {
  id: string;
  kind: VehicleKind;
  name: string;
  nameKey: string;
  /** null = semilla. */
  createdBy: string | null;
  createdAt: Date;
};

export type NewBrand = {
  /** Lo genera la app, para poder crear sin señal. */
  id?: string;
  kind: VehicleKind;
  name: string;
  nameKey: string;
  createdBy: string;
};

export interface BrandRepository {
  /** Ordenadas por `name`. */
  findByKind(kind: VehicleKind): Promise<Brand[]>;
  findById(id: string): Promise<Brand | null>;
  findByKindAndKey(kind: VehicleKind, nameKey: string): Promise<Brand | null>;
  /** Cuántas creó ese usuario desde `desde`. Para el tope diario. */
  countCreatedBy(userId: string, desde: Date): Promise<number>;
  /**
   * Inserta, o devuelve la que ya estaba si otra petición ganó la carrera.
   *
   * La carrera es real: dos usuarios agregando "Chery" a la vez pasan los dos
   * el chequeo previo del servicio. Que se resuelva acá y no en el servicio es
   * a propósito — atrapar la violación del índice único requiere conocer el
   * código de error del motor, y eso no puede salir de la frontera.
   */
  createIfAbsent(data: NewBrand): Promise<{ brand: Brand; created: boolean }>;
}
