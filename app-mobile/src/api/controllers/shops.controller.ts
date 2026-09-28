// Endpoints de /shops. Un archivo por recurso.
import { ApiClient } from '../base';

export type ApiShop = {
  id: string;
  name: string;
  /** Lo calcula el servidor. La app lo usa para deduplicar sin recalcularlo. */
  nameKey: string;
};

/** Lo que devuelve el alta: el taller más si esta petición lo creó. */
export type ApiShopCreado = ApiShop & { created: boolean };

class ShopsController extends ApiClient {
  constructor() {
    super('/shops');
  }

  listar(): Promise<ApiShop[]> {
    return this.get<ApiShop[]>('', { auth: true });
  }

  /**
   * `id` lo genera la app: el backend lo usa como clave de idempotencia.
   * `crearTaller` y no `crear`, por lo mismo que `crearMarca`: el runner junta
   * los controladores en una intersección de tipos.
   */
  crearTaller(id: string, name: string): Promise<ApiShopCreado> {
    return this.post<ApiShopCreado>('', { auth: true, body: { id, name } });
  }
}

export const shopsController = new ShopsController();
