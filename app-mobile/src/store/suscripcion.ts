// El plan del usuario y el catálogo de planes, desde el backend.
//
// Antes vivían en el mock (PLANS, MOCK_SUBSCRIPTION) y los topes eran solo
// texto: nadie los hacía cumplir. Ahora el servidor es la autoridad y los
// aplica; acá hay una copia para pintar la pantalla y para avisar ANTES de
// que el usuario llene un formulario que el servidor va a rechazar.
//
// Se persiste para que el perfil no abra vacío sin señal.
import AsyncStorage from 'expo-sqlite/kv-store';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  subscriptionsController,
  type ApiPlan,
  type ApiSubscription,
} from '../api/controllers/subscriptions.controller';

type SuscripcionStore = {
  /** El catálogo, en el orden en que se muestra: el gratis primero. */
  planes: ApiPlan[];
  /** null hasta la primera carga de esta sesión. */
  suscripcion: ApiSubscription | null;
  cargar: () => Promise<void>;
  /** Al cerrar sesión: el plan es de la cuenta, no del teléfono. */
  limpiar: () => void;
};

export const useSuscripcion = create<SuscripcionStore>()(
  persist(
    (set) => ({
      planes: [],
      suscripcion: null,

      cargar: async () => {
        try {
          const [planes, suscripcion] = await Promise.all([
            subscriptionsController.planes(),
            subscriptionsController.mia(),
          ]);
          set({ planes, suscripcion });
        } catch {
          // Sin red se sigue mostrando lo último conocido.
        }
      },

      limpiar: () => set({ suscripcion: null }),
    }),
    {
      name: 'ruedalo:suscripcion',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ planes: s.planes, suscripcion: s.suscripcion }),
    }
  )
);

/** El plan que rige hoy, o null si todavía no se cargó. */
export const usePlan = (): ApiPlan | null =>
  useSuscripcion((s) => s.suscripcion?.plan ?? null);

/** Una línea de consumo contra un tope del plan. */
export type Uso = { k: string; usado: number; tope: number | null };

/** Consumo contra los topes. Lo calcula el servidor: el perfil y el detalle
 *  del plan muestran exactamente los mismos números. */
export const usoDe = (s: ApiSubscription): Uso[] => [
  { k: 'Vehículos', usado: s.usage.vehicles, tope: s.plan.maxVehicles },
  { k: 'Cambios este mes', usado: s.usage.changesThisMonth, tope: s.plan.maxChangesPerMonth },
];

/**
 * Si se puede agregar otro vehículo, mirando la flota que se ve en pantalla
 * (incluye lo que todavía no sincronizó).
 *
 * Sin suscripción cargada no bloquea: el servidor decide igual, y trabar al
 * usuario por no conocer su plan sería peor que dejar que el servidor diga
 * que no.
 */
export function quedaCupoVehiculo(sub: ApiSubscription | null, vehiculos: number): boolean {
  const tope = sub?.plan.maxVehicles ?? null;
  return tope === null || vehiculos < tope;
}

/**
 * Si cabe un cambio con esa fecha. Solo se conoce el uso del mes en curso,
 * así que un cambio fechado en otro mes no se bloquea acá: lo decide el
 * servidor. El mes se lee en UTC, igual que en el backend.
 */
export function quedaCupoCambio(
  sub: ApiSubscription | null,
  changedAt: string,
  ahora = new Date()
): boolean {
  const tope = sub?.plan.maxChangesPerMonth ?? null;
  if (tope === null || !sub) return true;

  const mes = (d: Date) => `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
  if (mes(new Date(changedAt)) !== mes(ahora)) return true;
  return sub.usage.changesThisMonth < tope;
}
