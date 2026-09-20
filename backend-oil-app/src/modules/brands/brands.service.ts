import { Inject, Injectable } from '@nestjs/common';
import { Errors } from '../../common/errors';
import type { VehicleKind } from '../oil/domain/vehicle.repository';
import {
  claveDeMarca,
  nombreValido,
  normalizarNombre,
} from './domain/brand-name';
import {
  BRAND_REPOSITORY,
  type Brand,
  type BrandRepository,
} from './domain/brand.repository';

/** Cinco por día por usuario. Ver Errors.brandLimitReached. */
const TOPE_DIARIO = 5;
const VENTANA_MS = 24 * 60 * 60 * 1000;

export type NewBrandInput = {
  id?: string;
  kind: VehicleKind;
  name: string;
};

@Injectable()
export class BrandsService {
  constructor(
    @Inject(BRAND_REPOSITORY) private readonly brands: BrandRepository,
  ) {}

  async list(kind: VehicleKind): Promise<Brand[]> {
    return this.brands.findByKind(kind);
  }

  /**
   * `now` es parámetro para que el tope diario se pueda probar sin esperar un
   * día ni manipular el reloj del proceso.
   */
  async create(
    userId: string,
    input: NewBrandInput,
    now: Date = new Date(),
  ): Promise<{ brand: Brand; created: boolean }> {
    if (!nombreValido(input.name)) throw Errors.brandNameInvalid();

    const name = normalizarNombre(input.name);
    const nameKey = claveDeMarca(name);

    // Idempotencia 1: la marca ya está en el catálogo. Es el caso más común —
    // dos usuarios que manejan un Chery. No consume cupo porque no aporta
    // ninguna fila nueva.
    const porClave = await this.brands.findByKindAndKey(input.kind, nameKey);
    if (porClave) return { brand: porClave, created: false };

    // Idempotencia 2: este id ya se envió. Es un reintento de la cola.
    if (input.id) {
      const porId = await this.brands.findById(input.id);
      if (porId) return { brand: porId, created: false };
    }

    const desde = new Date(now.getTime() - VENTANA_MS);
    const creadasHoy = await this.brands.countCreatedBy(userId, desde);
    if (creadasHoy >= TOPE_DIARIO) throw Errors.brandLimitReached();

    return this.brands.createIfAbsent({
      id: input.id,
      kind: input.kind,
      name,
      nameKey,
      createdBy: userId,
    });
  }
}
