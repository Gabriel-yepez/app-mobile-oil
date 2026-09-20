// El catálogo de marcas: lo que el selector ofrece en el alta y en la edición.
//
// Lleva SU PROPIA cola, separada de la de vehículos, reusando las mismas
// funciones puras `encolar` y `drenar`. Es reuso, no duplicación.
//
// Se puede porque las dos son independientes: un vehículo con marca "Chery" no
// necesita que exista la fila Chery, ya que `Vehicle.brand` viaja como texto.
// No hay orden que respetar entre las dos colas, que es lo único que obligaría
// a unificarlas.
//
// CUÁNDO REVERTIR ESTO: en cuanto aparezca un tercer escritor con cola propia,
// hay que extraer un `useSync` de verdad. Con dos todavía no se paga el riesgo.
import { useMemo } from 'react';
import { create } from 'zustand';
import { brandsController } from '../api/controllers/brands.controller';
import type { ApiBrand } from '../api/controllers/brands.controller';
import { nuevoId } from '../data/ids';
import {
  guardarColaMarcas,
  guardarMarcas,
  leerColaMarcas,
  leerMarcas,
  type MarcasPorTipo,
} from '../data/local/store';
import { avisoDeAlta, avisoDeFallo, type Aviso } from '../data/marcas/aviso';
import { claveDeMarca, normalizarNombre } from '../data/marcas/nombre';
import { toast } from './toast';
import { encolar } from '../data/sync/queue';
import type { QueueEntry } from '../data/sync/queue';
import { drenar } from '../data/sync/runner';
import type { VehicleKind } from '../data/types';

/**
 * Las 18 con las que la app venía funcionando. Siguen acá además de estar
 * sembradas en el backend, y no es redundancia por descuido: sin esto, una
 * instalación nueva sin señal abriría el selector VACÍO justo en el paso 2 del
 * alta. La lista del servidor las pisa en el primer refresco exitoso.
 *
 * Si agregás o quitás una acá, hacé lo mismo en la migración `_brands`.
 */
const nombres = (kind: VehicleKind, xs: string[]): ApiBrand[] =>
  xs.map((name) => ({
    id: `semilla-${kind}-${claveDeMarca(name)}`,
    kind,
    name,
    nameKey: claveDeMarca(name),
  }));

const SEMILLA: MarcasPorTipo = {
  car: nombres('car', [
    'Toyota', 'Chevrolet', 'Ford', 'Hyundai', 'Kia',
    'Renault', 'Fiat', 'Jeep', 'Nissan', 'Mitsubishi',
  ]),
  moto: nombres('moto', [
    'Bera', 'Empire Keeway', 'MD', 'Yamaha',
    'Suzuki', 'Honda', 'AVA', 'Skygo',
  ]),
};

/**
 * Las del servidor más las que todavía no salieron, sin duplicados.
 *
 * Deduplica por `nameKey` y deja ganar a la del servidor: es la versión que
 * ven los demás usuarios, así que mostrar otra sería mentir sobre el catálogo.
 */
export function unirMarcas(
  servidor: ApiBrand[],
  pendientes: ApiBrand[],
): ApiBrand[] {
  const porClave = new Map<string, ApiBrand>();
  for (const p of pendientes) porClave.set(p.nameKey, p);
  for (const s of servidor) porClave.set(s.nameKey, s);
  return [...porClave.values()].sort((a, b) =>
    a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }),
  );
}

const mostrar = (aviso: Aviso) => {
  if (aviso) toast[aviso.kind](aviso.text);
};

type Estado = {
  marcas: MarcasPorTipo;
  pendientes: MarcasPorTipo;
  cola: QueueEntry[];
  hydrated: boolean;
  hidratar: () => Promise<void>;
  refresh: () => Promise<void>;
  /** Devuelve el id generado. Pinta al instante y encola el envío. */
  agregar: (kind: VehicleKind, name: string) => string;
  sincronizar: () => Promise<void>;
};

export const useBrands = create<Estado>((set, get) => ({
  marcas: SEMILLA,
  pendientes: { car: [], moto: [] },
  cola: [],
  hydrated: false,

  hidratar: async () => {
    const [marcas, cola] = await Promise.all([leerMarcas(), leerColaMarcas()]);
    set({
      // Si la caché está vacía (instalación nueva) se queda la semilla: un
      // selector vacío en el paso 2 del alta es peor que una lista corta.
      marcas: marcas.car.length + marcas.moto.length > 0 ? marcas : SEMILLA,
      cola,
      hydrated: true,
    });
  },

  refresh: async () => {
    const [car, moto] = await Promise.all([
      brandsController.listar('car'),
      brandsController.listar('moto'),
    ]);
    const marcas = { car, moto };
    set({ marcas });
    void guardarMarcas(marcas);
  },

  agregar: (kind, name) => {
    const id = nuevoId();
    const limpio = normalizarNombre(name);
    const nueva: ApiBrand = {
      id,
      kind,
      name: limpio,
      nameKey: claveDeMarca(limpio),
    };

    const pendientes = {
      ...get().pendientes,
      [kind]: [...get().pendientes[kind], nueva],
    };
    const cola = encolar(get().cola, {
      op: 'CREATE_BRAND',
      id,
      kind,
      payload: { name: limpio },
    });

    set({ pendientes, cola });
    void guardarMarcas(get().marcas);
    void guardarColaMarcas(cola);
    void get().sincronizar();
    return id;
  },

  sincronizar: async () => {
    const r = await drenar({
      leerCola: () => get().cola,
      guardarCola: (cola) => {
        set({ cola });
        void guardarColaMarcas(cola);
      },
      marcarRechazado: (op) => {
        // Una marca rechazada no se le muestra al usuario: la validación del
        // cliente replica la del servidor, así que llegar acá es casi
        // imposible. Si pasa, se saca de las pendientes y listo — el próximo
        // refresco deja la lista consistente y el usuario la reescribe. No se
        // inventa un canal de errores nuevo para esto. `marcas` no se toca:
        // es lo que dijo el servidor y un fallo local no debe modificarlo.
        set((st) => ({
          pendientes: {
            car: st.pendientes.car.filter((b) => b.id !== op.id),
            moto: st.pendientes.moto.filter((b) => b.id !== op.id),
          },
        }));
      },
      api: {
        // El aviso se engancha ACÁ y no en el runner: es feedback propio de
        // las marcas y el runner no tiene por qué saber de toasts. Sale
        // cuando el servidor contesta, que es el único momento en que se sabe
        // si la marca se creó o si ya estaba.
        crearMarca: async (id, kind, name) => {
          try {
            const r = await brandsController.crearMarca(id, kind, name);
            mostrar(avisoDeAlta(r));
            return r;
          } catch (e) {
            mostrar(avisoDeFallo(e));
            // Se relanza: el runner decide qué hacer con la operación, y esa
            // decisión no cambia porque hayamos avisado.
            throw e;
          }
        },
      },
    });

    // Mismo criterio que useVehicles.sincronizar: mientras quede algo y no
    // esté pausada, se sigue. El resultado trae la espera si el fallo fue
    // transitorio, y en ese caso se corta acá.
    if (!r.vacia && !r.pausada && r.esperarMs === null) {
      await get().sincronizar();
    }
  },
}));

/**
 * Los nombres que el selector debe ofrecer para ese tipo.
 *
 * OJO con la forma de esto. Los dos selectores devuelven la MISMA referencia
 * mientras el estado no cambie, y la combinación se arma afuera con useMemo.
 *
 * Hacerlo al revés —`useBrands((s) => unirMarcas(...))`— es un bucle infinito
 * de renders: zustand compara el resultado del selector con `Object.is`, y
 * `unirMarcas` construye un array nuevo en cada llamada, así que cada render
 * parece un cambio de estado y dispara el siguiente. La app muere con
 * "Maximum update depth exceeded" al abrir el formulario.
 *
 * Regla: un selector de zustand nunca debe construir un objeto o un array.
 */
export const useMarcasDe = (kind: VehicleKind): string[] => {
  const marcas = useBrands((s) => s.marcas[kind]);
  const pendientes = useBrands((s) => s.pendientes[kind]);

  return useMemo(
    () => unirMarcas(marcas, pendientes).map((b) => b.name),
    [marcas, pendientes],
  );
};
