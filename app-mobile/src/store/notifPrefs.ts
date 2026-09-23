// Preferencias de notificación.
//
// Viven en el BACKEND: es el servidor el que decide a quién avisar, así que
// tiene que conocerlas, y de paso sobreviven a reinstalar la app. Este slice
// es una copia de trabajo, no el dueño.
//
// Lo único que sigue siendo del teléfono es `permissionAskedAt`: eso es un
// hecho del dispositivo —si ya se mostró el diálogo nativo— y no una
// preferencia de la cuenta. Por eso es lo único que se persiste acá.
import AsyncStorage from 'expo-sqlite/kv-store';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  notificationsController,
  type ApiNotifPrefs,
} from '../api/controllers/notifications.controller';

export type { ApiNotifPrefs as NotifPrefs };

/** Los mismos valores que el backend le devuelve a quien nunca las tocó. */
export const DEFAULT_PREFS: ApiNotifPrefs = {
  enabled: true,
  warnEnabled: true,
  overdueEnabled: true,
  checkinEnabled: true,
  warnThresholdKm: 500,
  checkinWeekday: 1,
};

type NotifPrefsStore = {
  prefs: ApiNotifPrefs;
  /** true mientras se está pidiendo la copia del servidor. */
  cargando: boolean;
  /**
   * false hasta que termina de leerse el almacenamiento. useFirstRunPermission
   * espera a esto: sin él pediría el permiso otra vez antes de enterarse de
   * que ya se pidió, y en iOS ese diálogo solo se muestra una vez por
   * instalación.
   */
  hydrated: boolean;
  /** epoch ms de cuándo se mostró el diálogo nativo; null = nunca. */
  permissionAskedAt: number | null;
  cargar: () => Promise<void>;
  setPref: <K extends keyof ApiNotifPrefs>(
    key: K,
    value: ApiNotifPrefs[K]
  ) => Promise<void>;
  markPermissionAsked: () => void;
};

export const useNotifPrefs = create<NotifPrefsStore>()(
  persist(
    (set, get) => ({
      prefs: DEFAULT_PREFS,
      cargando: false,
      hydrated: false,
      permissionAskedAt: null,

      cargar: async () => {
        set({ cargando: true });
        try {
          set({ prefs: await notificationsController.obtenerPrefs() });
        } catch {
          // Sin red se sigue mostrando lo último conocido: una pantalla de
          // ajustes en blanco es peor que una desactualizada.
        } finally {
          set({ cargando: false });
        }
      },

      setPref: async (key, value) => {
        // Optimista: el switch se mueve al tocarlo, no cuando el servidor
        // conteste. Si falla, vuelve solo a donde estaba.
        const previo = get().prefs;
        set({ prefs: { ...previo, [key]: value } });
        try {
          set({
            prefs: await notificationsController.guardarPrefs({ [key]: value }),
          });
        } catch {
          set({ prefs: previo });
        }
      },

      markPermissionAsked: () => set({ permissionAskedAt: Date.now() }),
    }),
    {
      name: 'ruedalo:notif-prefs',
      storage: createJSONStorage(() => AsyncStorage),
      // Solo el hecho del dispositivo. Persistir las preferencias crearía una
      // segunda verdad que se desincroniza de la del servidor.
      partialize: (s) => ({ permissionAskedAt: s.permissionAskedAt }),
      onRehydrateStorage: () => () =>
        useNotifPrefs.setState({ hydrated: true }),
    }
  )
);
