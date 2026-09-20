// Endpoints de /brands. Un archivo por recurso.
import { ApiClient } from '../base';
import type { VehicleKind } from '../../data/types';

/** Como la ve la app: `kind` en minúsculas, igual que el resto del código. */
export type ApiBrand = {
  id: string;
  kind: VehicleKind;
  name: string;
  /** Lo calcula el servidor. La app lo usa para deduplicar sin recalcularlo. */
  nameKey: string;
};

/** Lo que devuelve el alta: la marca más si esta petición la creó. */
export type ApiBrandCreada = ApiBrand & { created: boolean };

type MarcaCruda = Omit<ApiBrand, 'kind'> & { kind: 'CAR' | 'MOTO' };
type MarcaCreadaCruda = MarcaCruda & { created: boolean };

const aDominio = (b: MarcaCruda): ApiBrand => ({
  ...b,
  kind: b.kind === 'CAR' ? 'car' : 'moto',
});

const aBackend = (k: VehicleKind): 'CAR' | 'MOTO' =>
  k === 'car' ? 'CAR' : 'MOTO';

class BrandsController extends ApiClient {
  constructor() {
    super('/brands');
  }

  async listar(kind: VehicleKind): Promise<ApiBrand[]> {
    const crudas = await this.get<MarcaCruda[]>(`?kind=${aBackend(kind)}`, {
      auth: true,
    });
    return crudas.map(aDominio);
  }

  /**
   * `id` lo genera la app: el backend lo usa como clave de idempotencia.
   *
   * Se llama `crearMarca` y no `crear` porque `vehiclesController` ya tiene un
   * `crear`, y el runner los junta en una intersección de tipos.
   */
  async crearMarca(
    id: string,
    kind: VehicleKind,
    name: string,
  ): Promise<ApiBrandCreada> {
    const cruda = await this.post<MarcaCreadaCruda>('', {
      auth: true,
      body: { id, kind: aBackend(kind), name },
    });
    return { ...aDominio(cruda), created: cruda.created };
  }
}

export const brandsController = new BrandsController();
