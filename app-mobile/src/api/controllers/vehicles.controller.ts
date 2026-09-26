// Endpoints de /vehicles. Un archivo por recurso.
import { ApiClient } from '../base';
import type {
  NewOilChangeInput,
  NewVehicleInput,
  VehicleKind,
} from '../../data/types';
import type { Gauge, Odometer } from './oil-status.controller';

/** Como la ve la app: `kind` en minúsculas, igual que el resto del código. */
export type ApiVehicle = {
  id: string;
  kind: VehicleKind;
  brand: string;
  model: string;
  year: number;
  plate: string;
  color: string;
  kmPerDay: number;
  kmPerDaySource: 'DECLARED' | 'MEASURED';
  lastChangeKm: number | null;
  lastChangeAt: string | null;
  nextChangeKm: number | null;
  /** ISO. Hasta cuándo el usuario pospuso la alerta del aceite; null si no
   *  lo hizo. Mientras sea futura, la alerta no cuenta como abierta. */
  alertSnoozedUntil: string | null;
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
  /** La alerta que este cambio atendió: el estado del aceite justo antes de
   *  hacerlo. null si se hizo sin alerta (adelantado) o es el primero. */
  resolvedAlert: 'warn' | 'danger' | null;
};

export type ApiOilChangePage = {
  items: ApiOilChange[];
  /** null significa que no hay más: sin esto la app pagina para siempre. */
  nextCursor: string | null;
};

/** Forma del backend: es la única que sabe de mayúsculas. */
type VehiculoCrudo = Omit<ApiVehicle, 'kind'> & { kind: 'CAR' | 'MOTO' };

const aDominio = (v: VehiculoCrudo): ApiVehicle => ({
  ...v,
  kind: v.kind === 'CAR' ? 'car' : 'moto',
});

const aBackend = <T extends { kind?: VehicleKind }>(input: T) => ({
  ...input,
  ...(input.kind ? { kind: input.kind === 'car' ? 'CAR' : 'MOTO' } : {}),
});

class VehiclesController extends ApiClient {
  constructor() {
    super('/vehicles');
  }

  async listar(): Promise<ApiVehicle[]> {
    return (await this.get<VehiculoCrudo[]>('', { auth: true })).map(aDominio);
  }

  /** Idempotente: reenviar el mismo id devuelve el existente, no duplica. */
  async crear(id: string, input: NewVehicleInput): Promise<ApiVehicle> {
    return aDominio(
      await this.post<VehiculoCrudo>('', {
        auth: true,
        body: { id, ...aBackend(input) },
      }),
    );
  }

  async editar(
    id: string,
    patch: Partial<NewVehicleInput>,
  ): Promise<ApiVehicle> {
    return aDominio(
      await this.patch<VehiculoCrudo>(`/${id}`, {
        auth: true,
        body: aBackend(patch),
      }),
    );
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

  /** Calla la alerta `days` días (1 a 30). Devuelve la ficha con su estado. */
  async posponerAlerta(id: string, days: number): Promise<ApiVehicle> {
    return aDominio(
      await this.put<VehiculoCrudo>(`/${id}/alert-snooze`, {
        auth: true,
        body: { days },
      }),
    );
  }

  async reactivarAlerta(id: string): Promise<ApiVehicle> {
    return aDominio(
      await this.del<VehiculoCrudo>(`/${id}/alert-snooze`, { auth: true }),
    );
  }
}

export const vehiclesController = new VehiclesController();
