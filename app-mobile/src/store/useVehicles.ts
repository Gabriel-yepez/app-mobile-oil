// La flota. Reemplaza la parte de vehículos de useStore, que cargaba mock.
//
// Ciclo de vida: hidrata de local → pinta ya → refresca de red → guarda local.
// Nunca hay una pantalla en blanco esperando la red.
//
// Escribir es siempre local primero: la UI se actualiza al instante y la
// operación entra a la cola. Como el id lo pone la app, el registro que se ve
// antes y después de sincronizar es el mismo — no hay parpadeo ni salto.
import { create } from 'zustand';
import { nuevoId } from '../data/ids';
import {
  guardarCola,
  guardarFlota,
  leerCola,
  leerFlota,
} from '../data/local/store';
import { encolar } from '../data/sync/queue';
import type { QueueEntry, QueueOp } from '../data/sync/queue';
import { drenar } from '../data/sync/runner';
import type { NewOilChangeInput, NewVehicleInput } from '../data/types';
import {
  vehiclesController,
  type ApiVehicle,
} from '../api/controllers/vehicles.controller';
import { oilStatusController } from '../api/controllers/oil-status.controller';
import { toast } from './toast';

type VehiclesStore = {
  vehicles: ApiVehicle[];
  /** false hasta que termina de leerse el almacenamiento. Las pantallas
   *  esperan a esto para no pintar una lista vacía y llenarla a la vista. */
  hydrated: boolean;
  cola: QueueEntry[];
  /** id → código del error que lo rechazó. Nada desaparece en silencio. */
  rechazos: Record<string, string>;
  activeVehicleId: string | null;

  hidratar: () => Promise<void>;
  refresh: () => Promise<void>;
  /** Devuelve el id nuevo: la pantalla navega al detalle sin esperar la red. */
  addVehicle: (input: NewVehicleInput) => string;
  updateVehicle: (id: string, patch: Partial<NewVehicleInput>) => void;
  /** Una lectura del tablero. El odómetro no es un campo del vehículo sino un
   *  hecho fechado, así que se reporta, no se edita. */
  reportOdometer: (vehicleId: string, km: number) => void;
  /** Registra un cambio. Devuelve su id: la pantalla puede navegar sin
   *  esperar a la red. */
  registrarCambio: (vehicleId: string, input: NewOilChangeInput) => string;
  /** "Posponer" en Alertas. Va directo a la red y no a la cola: es un
   *  silencio de días, y encolarlo sin señal daría por pospuesta una alerta
   *  cuyas push el servidor seguiría mandando. Si falla, se revierte y el
   *  error sube para que la pantalla lo diga. */
  posponerAlerta: (vehicleId: string, days: number) => Promise<void>;
  reactivarAlerta: (vehicleId: string) => Promise<void>;
  removeVehicle: (id: string) => void;
  setActiveVehicle: (id: string) => void;
  sincronizar: () => Promise<void>;
};

/** Una ficha local, mientras el servidor todavía no la conoce. */
const fichaLocal = (id: string, input: NewVehicleInput): ApiVehicle => ({
  id,
  ...input,
  kmPerDaySource: 'DECLARED',
  lastChangeKm: null,
  lastChangeAt: null,
  nextChangeKm: null,
  alertSnoozedUntil: null,
  // Sin ciclo todavía: la tarjeta muestra el CTA de registrar el primer cambio.
  gauge: null,
  odometer: null,
});

export const useVehicles = create<VehiclesStore>((set, get) => {
  const persistir = (vehicles: ApiVehicle[], cola: QueueEntry[]) => {
    void guardarFlota(vehicles);
    void guardarCola(cola);
  };

  /** Cambia el posponer: optimista, y con la ficha del servidor al volver. */
  const escribirAlerta = async (
    vehicleId: string,
    optimista: string | null,
    llamada: () => Promise<ApiVehicle>,
  ) => {
    const previo = get().vehicles.find((v) => v.id === vehicleId);
    if (!previo) return;
    const reemplazar = (ficha: ApiVehicle) => {
      const vehicles = get().vehicles.map((v) => (v.id === vehicleId ? ficha : v));
      set({ vehicles });
      void guardarFlota(vehicles);
    };

    reemplazar({ ...previo, alertSnoozedUntil: optimista });
    try {
      reemplazar(await llamada());
    } catch (e) {
      reemplazar(previo);
      throw e;
    }
  };

  const encolarOp = (op: QueueOp, vehicles: ApiVehicle[]) => {
    const cola = encolar(get().cola, op);
    set({ vehicles, cola });
    persistir(vehicles, cola);
    void get().sincronizar();
  };

  return {
    vehicles: [],
    hydrated: false,
    cola: [],
    rechazos: {},
    activeVehicleId: null,

    hidratar: async () => {
      const [vehicles, cola] = await Promise.all([leerFlota(), leerCola()]);
      set((s) => ({
        vehicles,
        cola,
        hydrated: true,
        // Si ya había uno activo se respeta; si no, el primero que haya.
        activeVehicleId: s.activeVehicleId ?? vehicles[0]?.id ?? null,
      }));
    },

    refresh: async () => {
      const vehicles = await vehiclesController.listar();
      set((s) => ({
        vehicles,
        // El activo sobrevive al refresco salvo que ya no exista.
        activeVehicleId: vehicles.some((v) => v.id === s.activeVehicleId)
          ? s.activeVehicleId
          : (vehicles[0]?.id ?? null),
      }));
      void guardarFlota(vehicles);
    },

    addVehicle: (input) => {
      const id = nuevoId();
      encolarOp({ op: 'CREATE_VEHICLE', id, payload: input }, [
        ...get().vehicles,
        fichaLocal(id, input),
      ]);
      return id;
    },

    updateVehicle: (id, patch) => {
      encolarOp(
        { op: 'UPDATE_VEHICLE', id, payload: patch },
        get().vehicles.map((v) => (v.id === id ? { ...v, ...patch } : v)),
      );
    },

    registrarCambio: (vehicleId, input) => {
      const id = nuevoId();
      encolarOp(
        { op: 'CREATE_OIL_CHANGE', id, vehicleId, payload: input },
        // El ciclo nuevo se refleja de una: el medidor vuelve a lleno sin
        // esperar la red, que es lo que el usuario espera ver al guardar.
        get().vehicles.map((v) =>
          v.id === vehicleId
            ? {
                ...v,
                lastChangeKm: input.km,
                lastChangeAt: input.changedAt,
                nextChangeKm: input.km + input.intervalKm,
                // El servidor la quita al registrar: el ciclo nuevo no
                // hereda el silencio del que se cerró.
                alertSnoozedUntil: null,
                odometer: {
                  km: input.km,
                  source: 'reported',
                  asOf: input.changedAt,
                },
              }
            : v,
        ),
      );
      return id;
    },

    posponerAlerta: async (vehicleId, days) => {
      const optimista = new Date(Date.now() + days * 86_400_000).toISOString();
      await escribirAlerta(vehicleId, optimista, () =>
        vehiclesController.posponerAlerta(vehicleId, days),
      );
    },

    reactivarAlerta: async (vehicleId) => {
      await escribirAlerta(vehicleId, null, () =>
        vehiclesController.reactivarAlerta(vehicleId),
      );
    },

    reportOdometer: (vehicleId, km) => {
      const ahora = new Date().toISOString();
      encolarOp(
        { op: 'REPORT_ODOMETER', id: nuevoId(), vehicleId, km },
        // Se refleja de una en la ficha para que la lista no siga mostrando
        // el número viejo mientras la cola sincroniza.
        get().vehicles.map((v) =>
          v.id === vehicleId
            ? { ...v, odometer: { km, source: 'reported', asOf: ahora } }
            : v,
        ),
      );
    },

    removeVehicle: (id) => {
      const vehicles = get().vehicles.filter((v) => v.id !== id);
      encolarOp({ op: 'DELETE_VEHICLE', id }, vehicles);
      // Si se borró el activo hay que mover el puntero: si no, el inicio se
      // queda pidiendo un vehículo que ya no está.
      if (get().activeVehicleId === id) {
        set({ activeVehicleId: vehicles[0]?.id ?? null });
      }
    },

    setActiveVehicle: (id) => set({ activeVehicleId: id }),

    sincronizar: async () => {
      const r = await drenar({
        leerCola: () => get().cola,
        guardarCola: (cola) => {
          set({ cola });
          void guardarCola(cola);
        },
        marcarRechazado: (op, code) => {
          set((s) => ({ rechazos: { ...s.rechazos, [op.id]: code } }));
          if (op.op === 'CREATE_OIL_CHANGE') {
            // Un vehículo rechazado se ve en su tarjeta, pero un cambio no
            // tiene dónde mostrarse: sin este aviso desaparecería en silencio.
            toast.error(
              code === 'OIL_CHANGE_LIMIT_REACHED'
                ? 'No se guardó un cambio de aceite: llegaste al tope de cambios de tu plan este mes.'
                : 'No se pudo guardar un cambio de aceite.',
            );
            // Al registrarlo se reflejó en el medidor sin esperar la red; el
            // servidor dijo que no, así que se vuelve a lo que él tiene.
            void get().refresh().catch(() => {});
          }
        },
        api: {
          crear: vehiclesController.crear.bind(vehiclesController),
          editar: vehiclesController.editar.bind(vehiclesController),
          borrar: vehiclesController.borrar.bind(vehiclesController),
          registrarCambio:
            vehiclesController.registrarCambio.bind(vehiclesController),
          editarCambio:
            vehiclesController.editarCambio.bind(vehiclesController),
          borrarCambio:
            vehiclesController.borrarCambio.bind(vehiclesController),
          reportOdometer:
            oilStatusController.reportOdometer.bind(oilStatusController),
        },
      });

      // Mientras quede algo y no esté pausada, se sigue drenando. El resultado
      // trae la espera cuando el fallo fue transitorio.
      if (!r.vacia && !r.pausada && r.esperarMs === null) {
        await get().sincronizar();
      }
    },
  };
});

/** Cuántos vehículos necesitan atención, según el estado que calcula el
 *  backend. Un vehículo sin ciclo no cuenta: no hay nada que vencer todavía. */
export const useOpenAlerts = (): number =>
  useVehicles((s) => contarAlertasAbiertas(s.vehicles, new Date()));

/** Si el usuario pospuso la alerta y el plazo sigue corriendo. Al vencer,
 *  vuelve a contar sola: nadie tiene que "despertarla". */
export const alertaPospuesta = (v: ApiVehicle, ahora: Date): boolean =>
  // Laxo a propósito: la flota guardada por una versión anterior de la app
  // no trae el campo, y ahí llega undefined en vez de null.
  !!v.alertSnoozedUntil && new Date(v.alertSnoozedUntil) > ahora;

/** warn y danger, sin las pospuestas. Un vehículo sin ciclo no cuenta: no
 *  hay nada que vencer todavía. */
export const contarAlertasAbiertas = (vehicles: ApiVehicle[], ahora: Date): number =>
  vehicles.filter(
    (v) => v.gauge !== null && v.gauge.status !== 'ok' && !alertaPospuesta(v, ahora),
  ).length;

/** El vehículo activo, o null mientras no haya ninguno. */
export const useActiveVehicle = (): ApiVehicle | null =>
  useVehicles((s) => s.vehicles.find((v) => v.id === s.activeVehicleId) ?? null);
