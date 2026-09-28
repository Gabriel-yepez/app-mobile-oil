import { Inject, Injectable } from '@nestjs/common';
import { Errors } from '../../common/errors';
import { contieneGroseria } from '../brands/domain/palabras-vetadas';
import {
  claveDeTaller,
  nombreValido,
  normalizarNombre,
} from './domain/shop-name';
import {
  SHOP_REPOSITORY,
  type Shop,
  type ShopRepository,
} from './domain/shop.repository';

/** Cinco por día por usuario, igual que las marcas. */
const TOPE_DIARIO = 5;
const VENTANA_MS = 24 * 60 * 60 * 1000;

export type NewShopInput = {
  id?: string;
  name: string;
};

@Injectable()
export class ShopsService {
  constructor(
    @Inject(SHOP_REPOSITORY) private readonly shops: ShopRepository,
  ) {}

  async list(): Promise<Shop[]> {
    return this.shops.findAll();
  }

  /** `now` es parámetro para probar el tope diario sin tocar el reloj. */
  async create(
    userId: string,
    input: NewShopInput,
    now: Date = new Date(),
  ): Promise<{ shop: Shop; created: boolean }> {
    if (!nombreValido(input.name)) throw Errors.shopNameInvalid();
    // Mismo error que el charset, por la razón que explica BrandsService.
    if (contieneGroseria(input.name)) throw Errors.shopNameInvalid();

    const name = normalizarNombre(input.name);
    const r = await this.shops.createIfAbsent(
      { id: input.id, name, nameKey: claveDeTaller(name), createdBy: userId },
      { desde: new Date(now.getTime() - VENTANA_MS), tope: TOPE_DIARIO },
    );

    if ('limiteAlcanzado' in r) throw Errors.shopLimitReached();
    return r;
  }
}
