// La cola de escrituras pendientes.
//
// PURA a propósito, igual que home/layout.ts: acá vive toda la decisión de qué
// se envía, en qué orden y qué se colapsa contra qué, y eso se prueba con una
// tabla de casos en vez de simulando una red que falla a voluntad.
import type { NewOilChangeInput, NewVehicleInput, VehicleKind } from '../types';

export type QueueOp =
  | { op: 'CREATE_VEHICLE'; id: string; payload: NewVehicleInput }
  | { op: 'UPDATE_VEHICLE'; id: string; payload: Partial<NewVehicleInput> }
  | { op: 'DELETE_VEHICLE'; id: string }
  | {
      op: 'CREATE_OIL_CHANGE';
      id: string;
      vehicleId: string;
      payload: NewOilChangeInput;
    }
  | { op: 'UPDATE_OIL_CHANGE'; id: string; payload: Partial<NewOilChangeInput> }
  | { op: 'DELETE_OIL_CHANGE'; id: string }
  | { op: 'REPORT_ODOMETER'; id: string; vehicleId: string; km: number }
  // Sin regla de colapso: una marca no se puede editar ni borrar desde la app,
  // así que CREATE_BRAND nunca tiene con qué fusionarse.
  | {
      op: 'CREATE_BRAND';
      id: string;
      kind: VehicleKind;
      payload: { name: string };
    };

export type QueueEntry = {
  op: QueueOp;
  /** Para la espera creciente y para detectar la que nunca sale. */
  intentos: number;
  encoladaEn: string;
};

const nuevaEntrada = (op: QueueOp): QueueEntry => ({
  op,
  intentos: 0,
  encoladaEn: new Date().toISOString(),
});

/** Si la entrada pertenece a ese vehículo, sea su ficha o uno de sus cambios. */
const esDelVehiculo = (e: QueueEntry, vehicleId: string): boolean => {
  if ('vehicleId' in e.op) return e.op.vehicleId === vehicleId;
  return (
    (e.op.op === 'CREATE_VEHICLE' || e.op.op === 'UPDATE_VEHICLE') &&
    e.op.id === vehicleId
  );
};

/** La creación pendiente de ese id, si la hay. */
const indiceCreacion = (cola: QueueEntry[], op: QueueOp): number =>
  cola.findIndex((e) => e.op.op.startsWith('CREATE') && e.op.id === op.id);

export function encolar(cola: QueueEntry[], op: QueueOp): QueueEntry[] {
  // ── Borrar algo que todavía no se creó ────────────────────────────────
  // Las dos operaciones se anulan: mandar el DELETE de un id que el servidor
  // nunca vio es un 404 garantizado, y ese 404 es un fallo permanente que
  // habría que mostrarle al usuario por algo que hizo bien.
  if (op.op === 'DELETE_VEHICLE') {
    const seEstabaCreando = indiceCreacion(cola, op) !== -1;
    // Sus cambios pendientes se descartan igual: el cascade del backend los
    // haría irrelevantes, y si el vehículo nunca existió, menos todavía.
    const resto = cola.filter((e) => !esDelVehiculo(e, op.id));
    return seEstabaCreando ? resto : [...resto, nuevaEntrada(op)];
  }

  if (op.op === 'DELETE_OIL_CHANGE') {
    const seEstabaCreando = indiceCreacion(cola, op) !== -1;
    const resto = cola.filter((e) => e.op.id !== op.id);
    return seEstabaCreando ? resto : [...resto, nuevaEntrada(op)];
  }

  // ── Editar algo que ya tiene una op pendiente ─────────────────────────
  // Se fusiona el patch en la que ya está en la cola y se envía UNA vez, con
  // los valores finales. Sin esto, editar tres veces sin señal son tres
  // peticiones que el servidor aplica en orden para llegar al mismo lugar.
  if (op.op === 'UPDATE_VEHICLE' || op.op === 'UPDATE_OIL_CHANGE') {
    const i = cola.findIndex(
      (e) =>
        e.op.id === op.id &&
        'payload' in e.op &&
        (e.op.op.startsWith('CREATE') || e.op.op === op.op),
    );
    if (i !== -1) {
      const previa = cola[i];
      const fusionada: QueueEntry = {
        ...previa,
        op: {
          ...previa.op,
          payload: {
            ...(previa.op as { payload: object }).payload,
            ...op.payload,
          },
        } as QueueOp,
      };
      return [...cola.slice(0, i), fusionada, ...cola.slice(i + 1)];
    }
  }

  return [...cola, nuevaEntrada(op)];
}

/**
 * La más vieja. La cola es FIFO estricto y se envía de a una: en paralelo, un
 * cambio de aceite podría llegar antes que el vehículo que lo contiene.
 */
export function cabeza(cola: QueueEntry[]): QueueEntry | null {
  return cola[0] ?? null;
}

export function sacar(cola: QueueEntry[], op: QueueOp): QueueEntry[] {
  return cola.filter((e) => !(e.op.op === op.op && e.op.id === op.id));
}

export function marcarIntento(cola: QueueEntry[], op: QueueOp): QueueEntry[] {
  return cola.map((e) =>
    e.op.op === op.op && e.op.id === op.id
      ? { ...e, intentos: e.intentos + 1 }
      : e,
  );
}

const ESPERAS = [1_000, 4_000, 15_000, 60_000];

/**
 * Espera creciente, con techo de un minuto: sin techo, tras un día sin señal
 * el próximo reintento caería dentro de varias horas y el usuario abriría la
 * app con todo sin sincronizar y nada intentándolo.
 */
export function esperaMs(intentos: number): number {
  return ESPERAS[Math.min(intentos, ESPERAS.length - 1)];
}
