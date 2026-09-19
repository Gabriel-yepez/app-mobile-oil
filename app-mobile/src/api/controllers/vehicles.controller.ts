// Endpoints de /vehicles. Un archivo por recurso.
import { ApiClient } from '../base';
import type { NewOilChangeInput, NewVehicleInput } from '../../data/types';
import type { Gauge, Odometer } from './oil-status.controller';

export type ApiVehicle = {
  id: string;
  kind: 'CAR' | 'MOTO';
  brand: string;
  model: string;
  year: number;
  plate: string;
  color: string;
  kmPerDay: number;
  kmPerDaySource: 'DECLARED' | 'MEASURED';
  lastChangeKm: number | null;
  nextChangeKm: number | null;
  /** Viene con la lista para que la flota sea una sola llamada. */
  gauge: Gauge | null;
  odometer: Odometer | null;
};

export type ApiOilChange = {
  id: string;
  vehicleId: string;
  changedAt: string;
  km: number;
  intervalKm: number;
  intervalMonths: number;
  oilBrand: string;
  oilTag: string;
  oilViscosity: string;
  oilSynthetic: boolean;
  shop: string | null;
  costUsd: number | null;
};

export type ApiOilChangePage = {
  items: ApiOilChange[];
  /** null significa que no hay más: sin esto la app pagina para siempre. */
  nextCursor: string | null;
};

class VehiclesController extends ApiClient {
  constructor() {
    super('/vehicles');
  }

  listar() {
    return this.get<ApiVehicle[]>('', { auth: true });
  }

  /** Idempotente: reenviar el mismo id devuelve el existente, no duplica. */
  crear(id: string, input: NewVehicleInput) {
    return this.post<ApiVehicle>('', { auth: true, body: { id, ...input } });
  }

  editar(id: string, patch: Partial<NewVehicleInput>) {
    return this.patch<ApiVehicle>(`/${id}`, { auth: true, body: patch });
  }

  borrar(id: string) {
    return this.del<void>(`/${id}`, { auth: true });
  }

  historial(vehicleId: string, opts: { cursor?: string; limit?: number } = {}) {
    return this.get<ApiOilChangePage>(`/${vehicleId}/oil-changes`, {
      auth: true,
      query: { cursor: opts.cursor, limit: opts.limit },
    });
  }

  registrarCambio(id: string, vehicleId: string, input: NewOilChangeInput) {
    return this.post<ApiOilChange>(`/${vehicleId}/oil-changes`, {
      auth: true,
      body: { id, ...input },
    });
  }

  editarCambio(changeId: string, patch: Partial<NewOilChangeInput>) {
    return this.patch<ApiOilChange>(`/oil-changes/${changeId}`, {
      auth: true,
      body: patch,
    });
  }

  borrarCambio(changeId: string) {
    return this.del<void>(`/oil-changes/${changeId}`, { auth: true });
  }
}

export const vehiclesController = new VehiclesController();
