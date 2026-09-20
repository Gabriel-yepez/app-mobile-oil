// Drena la cola contra la API, de a una operación por vez.
//
// Toda la gracia está en clasificar el fallo. Un error de red hay que
// reintentarlo; un 422 no: reintentarlo mil veces da mil veces el mismo error
// y deja trabado todo lo que venga detrás. Sin esa distinción, un solo
// registro inválido congela la sincronización del usuario para siempre.
import { ApiError } from '../../api/base';
import type { vehiclesController } from '../../api/controllers/vehicles.controller';
import type { oilStatusController } from '../../api/controllers/oil-status.controller';
import { cabeza, esperaMs, marcarIntento, sacar } from './queue';
import type { QueueEntry, QueueOp } from './queue';

export type TipoFallo = 'transitorio' | 'permanente' | 'sesion';

export function clasificarFallo(e: unknown): TipoFallo {
  // Ante lo desconocido, conservar: descartar el trabajo del usuario por un
  // error que no entendemos es el peor default posible.
  if (!(e instanceof ApiError)) return 'transitorio';

  if (e.status === 401) return 'sesion';
  // status 0 es "no salió de acá": sin red o timeout.
  if (e.status === 0 || e.status === 429 || e.status >= 500) {
    return 'transitorio';
  }
  return 'permanente';
}

export type RunnerDeps = {
  leerCola: () => QueueEntry[];
  guardarCola: (cola: QueueEntry[]) => void;
  /** Lo llama el runner cuando una op muere: el registro local queda marcado
   *  con su motivo, para mostrárselo al usuario. Nada desaparece en silencio. */
  marcarRechazado: (op: QueueOp, code: string) => void;
  api: Pick<
    typeof vehiclesController,
    | 'crear'
    | 'editar'
    | 'borrar'
    | 'registrarCambio'
    | 'editarCambio'
    | 'borrarCambio'
  > &
    Pick<typeof oilStatusController, 'reportOdometer'>;
};

export type DrenajeResultado = {
  vacia: boolean;
  pausada: boolean;
  /** Cuánto esperar antes del próximo intento, si hubo fallo transitorio. */
  esperarMs: number | null;
};

async function enviar(op: QueueOp, api: RunnerDeps['api']): Promise<void> {
  switch (op.op) {
    case 'CREATE_VEHICLE':
      await api.crear(op.id, op.payload);
      return;
    case 'UPDATE_VEHICLE':
      await api.editar(op.id, op.payload);
      return;
    case 'DELETE_VEHICLE':
      await api.borrar(op.id);
      return;
    case 'CREATE_OIL_CHANGE':
      await api.registrarCambio(op.id, op.vehicleId, op.payload);
      return;
    case 'UPDATE_OIL_CHANGE':
      await api.editarCambio(op.id, op.payload);
      return;
    case 'DELETE_OIL_CHANGE':
      await api.borrarCambio(op.id);
      return;
    case 'REPORT_ODOMETER':
      await api.reportOdometer(op.vehicleId, op.km);
      return;
  }
}

/**
 * Envía UNA operación: la más vieja. De a una a propósito — en paralelo, un
 * cambio de aceite podría llegar antes que el vehículo que lo contiene.
 */
export async function drenar(deps: RunnerDeps): Promise<DrenajeResultado> {
  const cola = deps.leerCola();
  const entrada = cabeza(cola);
  if (!entrada) return { vacia: true, pausada: false, esperarMs: null };

  try {
    await enviar(entrada.op, deps.api);
    // El 200 de un create ya guardado llega acá igual que un 201: el backend
    // es idempotente, así que el reintento es un éxito, no un conflicto.
    deps.guardarCola(sacar(deps.leerCola(), entrada.op));
    return { vacia: false, pausada: false, esperarMs: null };
  } catch (e) {
    const tipo = clasificarFallo(e);

    if (tipo === 'sesion') {
      // La sesión murió. No se descarta nada: la cola espera a que el usuario
      // vuelva a entrar.
      return { vacia: false, pausada: true, esperarMs: null };
    }

    if (tipo === 'permanente') {
      deps.guardarCola(sacar(deps.leerCola(), entrada.op));
      deps.marcarRechazado(
        entrada.op,
        e instanceof ApiError ? e.code : 'UNKNOWN',
      );
      return { vacia: false, pausada: false, esperarMs: null };
    }

    deps.guardarCola(marcarIntento(deps.leerCola(), entrada.op));
    return {
      vacia: false,
      pausada: false,
      esperarMs: esperaMs(entrada.intentos + 1),
    };
  }
}
