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

/** Cuántas puede aportar el usuario y desde cuándo se cuenta. Lo decide el
 *  servicio; el repositorio solo lo aplica sin que nada se cuele en el medio. */
export type Cupo = { desde: Date; tope: number };

export type ResultadoAlta =
  | { brand: Brand; created: boolean }
  | { limiteAlcanzado: true };

export interface BrandRepository {
  /** Ordenadas por `name`. */
  findByKind(kind: VehicleKind): Promise<Brand[]>;

  /**
   * Crea la marca, salvo que ya exista o que el usuario haya agotado su cupo.
   *
   * Las tres cosas —comprobar el nombre, comprobar el id, contar el cupo— van
   * en la MISMA operación atómica que el insert. Separarlas deja un hueco:
   * dos peticiones simultáneas cuentan cuatro cada una, las dos concluyen que
   * hay lugar y las dos insertan. El tope se saltaría con un bucle en
   * paralelo, que es exactamente contra lo que existe.
   */
  createIfAbsent(data: NewBrand, cupo: Cupo): Promise<ResultadoAlta>;
}
