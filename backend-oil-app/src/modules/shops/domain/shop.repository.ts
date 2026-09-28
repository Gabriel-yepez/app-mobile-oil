// El taller como lo entiende el negocio. Sin tipos de Prisma.
//
// Calcado de BrandRepository, sin `kind`: un taller atiende carros y motos.
export const SHOP_REPOSITORY = Symbol('SHOP_REPOSITORY');

export type Shop = {
  id: string;
  name: string;
  nameKey: string;
  /** null = semilla. */
  createdBy: string | null;
  createdAt: Date;
};

export type NewShop = {
  /** Lo genera la app, para poder crear sin señal. */
  id?: string;
  name: string;
  nameKey: string;
  createdBy: string;
};

/** Cuántos puede aportar el usuario y desde cuándo se cuenta. */
export type Cupo = { desde: Date; tope: number };

export type ResultadoAlta =
  | { shop: Shop; created: boolean }
  | { limiteAlcanzado: true };

export interface ShopRepository {
  /** Ordenados por `name`. */
  findAll(): Promise<Shop[]>;

  /**
   * Crea el taller, salvo que ya exista o que el usuario haya agotado su cupo.
   * Las tres comprobaciones van en la MISMA operación atómica que el insert,
   * por lo mismo que en BrandRepository.createIfAbsent.
   */
  createIfAbsent(data: NewShop, cupo: Cupo): Promise<ResultadoAlta>;
}
