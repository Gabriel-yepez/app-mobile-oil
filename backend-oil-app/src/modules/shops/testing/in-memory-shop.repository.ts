// Doble en memoria con las MISMAS garantías que el de Prisma: unicidad de
// nameKey y cupo aplicado junto con el alta. Ver InMemoryBrandRepository.
import { randomUUID } from 'node:crypto';
import type {
  Cupo,
  NewShop,
  ResultadoAlta,
  Shop,
  ShopRepository,
} from '../domain/shop.repository';

export class InMemoryShopRepository implements ShopRepository {
  readonly filas: Shop[] = [];

  /** Para sembrar en los tests sin pasar por createIfAbsent. */
  sembrar(name: string, nameKey: string): Shop {
    const shop: Shop = {
      id: randomUUID(),
      name,
      nameKey,
      createdBy: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    this.filas.push(shop);
    return shop;
  }

  findAll(): Promise<Shop[]> {
    return Promise.resolve(
      [...this.filas].sort((a, b) => a.name.localeCompare(b.name, 'es')),
    );
  }

  createIfAbsent(data: NewShop, cupo: Cupo): Promise<ResultadoAlta> {
    const porClave = this.filas.find((s) => s.nameKey === data.nameKey);
    if (porClave) return Promise.resolve({ shop: porClave, created: false });

    if (data.id) {
      const porId = this.filas.find((s) => s.id === data.id);
      if (porId) return Promise.resolve({ shop: porId, created: false });
    }

    const creados = this.filas.filter(
      (s) => s.createdBy === data.createdBy && s.createdAt >= cupo.desde,
    ).length;
    if (creados >= cupo.tope) return Promise.resolve({ limiteAlcanzado: true });

    const shop: Shop = {
      id: data.id ?? randomUUID(),
      name: data.name,
      nameKey: data.nameKey,
      createdBy: data.createdBy,
      createdAt: new Date(),
    };
    this.filas.push(shop);
    return Promise.resolve({ shop, created: true });
  }
}
