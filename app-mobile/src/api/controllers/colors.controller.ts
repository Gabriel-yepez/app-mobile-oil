// Endpoints de /colors. Un archivo por recurso.
import { ApiClient } from '../base';

export type ApiColor = { name: string; hex: string };

class ColorsController extends ApiClient {
  constructor() {
    super('/colors');
  }

  async listar(): Promise<ApiColor[]> {
    return this.get<ApiColor[]>('', { auth: true });
  }
}

export const colorsController = new ColorsController();
