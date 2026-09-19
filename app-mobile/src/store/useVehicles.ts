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
import type { NewVehicleInput } from '../data/types';
import {
  vehiclesController,
  type ApiVehicle,
} from '../api/controllers/vehicles.controller';
import { oilStatusController } from '../api/controllers/oil-status.controller';

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
  nextChangeKm: null,
  // Sin ciclo todavía: la tarjeta muestra el CTA de registrar el primer cambio.
  gauge: null,
  odometer: null,
});

export const useVehicles = create<VehiclesStore>((set, get) => {
  const persistir = (vehicles: ApiVehicle[], cola: QueueEntry[]) => {
    void guardarFlota(vehicles);
    void guardarCola(cola);
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
        marcarRechazado: (op, code) =>
          set((s) => ({ rechazos: { ...s.rechazos, [op.id]: code } })),
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

/** El vehículo activo, o null mientras no haya ninguno. */
export const useActiveVehicle = (): ApiVehicle | null =>
  useVehicles((s) => s.vehicles.find((v) => v.id === s.activeVehicleId) ?? null);
