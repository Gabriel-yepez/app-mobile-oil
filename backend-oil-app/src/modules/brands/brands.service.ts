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

    // Las dos idempotencias —por nombre y por id— y el cupo se resuelven
    // dentro del alta, en una sola operación atómica. Comprobarlas acá y
    // después insertar dejaría un hueco entre la comprobación y el insert por
    // el que se cuelan las peticiones simultáneas.
    const r = await this.brands.createIfAbsent(
      { id: input.id, kind: input.kind, name, nameKey, createdBy: userId },
      { desde: new Date(now.getTime() - VENTANA_MS), tope: TOPE_DIARIO },
    );

    if ('limiteAlcanzado' in r) throw Errors.brandLimitReached();
    return r;
  }
}
