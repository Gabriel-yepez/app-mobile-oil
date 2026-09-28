// El catálogo de talleres: lo que ofrece el selector del cambio de aceite.
//
// Calcado de useBrands —su propia cola sobre las mismas funciones puras
// `encolar` y `drenar`— y por la misma razón: es independiente de las demás.
// El cambio de aceite guarda el taller como TEXTO, así que un cambio con
// "Taller Pérez" no necesita que la fila exista en el servidor.
//
// OJO: es el tercer escritor con cola propia. useBrands.ts dice que a partir
// de acá conviene extraer un `useSync` común; queda pendiente a propósito
// para no mezclar ese refactor con esta feature.
import { useMemo } from 'react';
import { create } from 'zustand';
import { shopsController } from '../api/controllers/shops.controller';
import type { ApiShop } from '../api/controllers/shops.controller';
import { nuevoId } from '../data/ids';
import {
  guardarColaTalleres,
  guardarTalleres,
  leerColaTalleres,
  leerTalleres,
} from '../data/local/store';
import type { Aviso } from '../data/marcas/aviso';
import { avisoDeAltaTaller, avisoDeFalloTaller } from '../data/talleres/aviso';
import { claveDeTaller, normalizarNombre } from '../data/talleres/nombre';
import { toast } from './toast';
import { encolar } from '../data/sync/queue';
import type { QueueEntry } from '../data/sync/queue';
import { drenar } from '../data/sync/runner';

/**
 * Los 6 con los que la app venía funcionando, para que una instalación nueva
 * sin señal no abra el selector vacío. Si cambias uno acá, cámbialo en la
 * migración `_shops`.
 */
const SEMILLA: ApiShop[] = [
  'Lubricantes El Marqués',
  'Servicar Las Mercedes',
  'Tecnicentro Cordero',
  'Auto Express La Castellana',
  'Lubricantes Sambil',
  'Mecánica La Trinidad',
].map((name) => ({
  id: `semilla-${claveDeTaller(name)}`,
  name,
  nameKey: claveDeTaller(name),
}));

/** Los del servidor más los que no salieron. Gana el del servidor. */
export function unirTalleres(
  servidor: ApiShop[],
  pendientes: ApiShop[],
): ApiShop[] {
  const porClave = new Map<string, ApiShop>();
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
  talleres: ApiShop[];
  pendientes: ApiShop[];
  cola: QueueEntry[];
  hidratar: () => Promise<void>;
  refresh: () => Promise<void>;
  /** Devuelve el id generado. Pinta al instante y encola el envío. */
  agregar: (name: string) => string;
  sincronizar: () => Promise<void>;
};

export const useShops = create<Estado>((set, get) => ({
  talleres: SEMILLA,
  pendientes: [],
  cola: [],

  hidratar: async () => {
    const [talleres, cola] = await Promise.all([
      leerTalleres(),
      leerColaTalleres(),
    ]);
    set({ talleres: talleres.length > 0 ? talleres : SEMILLA, cola });
  },

  refresh: async () => {
    const talleres = await shopsController.listar();
    set({ talleres });
    void guardarTalleres(talleres);
  },

  agregar: (name) => {
    const id = nuevoId();
    const limpio = normalizarNombre(name);
    const nuevo: ApiShop = { id, name: limpio, nameKey: claveDeTaller(limpio) };
    const cola = encolar(get().cola, {
      op: 'CREATE_SHOP',
      id,
      payload: { name: limpio },
    });

    set({ pendientes: [...get().pendientes, nuevo], cola });
    void guardarColaTalleres(cola);
    void get().sincronizar();
    return id;
  },

  sincronizar: async () => {
    const r = await drenar({
      leerCola: () => get().cola,
      guardarCola: (cola) => {
        set({ cola });
        void guardarColaTalleres(cola);
      },
      // Mismo criterio que useBrands: se saca de las pendientes y el próximo
      // refresco deja la lista consistente.
      marcarRechazado: (op) => {
        set((st) => ({ pendientes: st.pendientes.filter((t) => t.id !== op.id) }));
      },
      api: {
        crearTaller: async (id, name) => {
          try {
            const creado = await shopsController.crearTaller(id, name);
            mostrar(avisoDeAltaTaller(creado));
            return creado;
          } catch (e) {
            mostrar(avisoDeFalloTaller(e));
            throw e;
          }
        },
      },
    });

    if (!r.vacia && !r.pausada && r.esperarMs === null) {
      await get().sincronizar();
    }
  },
}));

/**
 * Los nombres que ofrece el selector. Los selectores devuelven referencias
 * estables y la unión se arma con useMemo: ver la advertencia de useMarcasDe
 * sobre el bucle infinito de renders.
 */
export const useTalleres = (): string[] => {
  const talleres = useShops((s) => s.talleres);
  const pendientes = useShops((s) => s.pendientes);
  return useMemo(
    () => unirTalleres(talleres, pendientes).map((t) => t.name),
    [talleres, pendientes],
  );
};
