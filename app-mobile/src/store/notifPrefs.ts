// Preferencias de notificación — el ÚNICO estado persistido de la app.
// El resto del store (vehículos, cambios, perfil) sigue en memoria con data
// mock; la persistencia completa llega con el backend.
import AsyncStorage from 'expo-sqlite/kv-store';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { DEFAULT_PREFS, NotifPrefs } from '../notifications/types';

type NotifPrefsStore = {
  prefs: NotifPrefs;
  /** false hasta que termina de leerse el almacenamiento. La reconciliación
   *  espera a esto para no programar con valores por defecto que el usuario
   *  ya había cambiado. */
  hydrated: boolean;
  setPref: <K extends keyof NotifPrefs>(key: K, value: NotifPrefs[K]) => void;
  markPermissionAsked: () => void;
};

export const useNotifPrefs = create<NotifPrefsStore>()(
  persist(
    (set) => ({
      prefs: DEFAULT_PREFS,
      hydrated: false,
      setPref: (key, value) => set((s) => ({ prefs: { ...s.prefs, [key]: value } })),
      markPermissionAsked: () =>
        set((s) => ({ prefs: { ...s.prefs, permissionAskedAt: Date.now() } })),
    }),
    {
      name: 'ruedalo:notif-prefs',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ prefs: s.prefs }),
      // Sin este merge, añadir una preferencia nueva en el futuro la dejaría
      // `undefined` en los usuarios que ya tengan datos guardados.
      merge: (persisted, current) => ({
        ...current,
        prefs: {
          ...DEFAULT_PREFS,
          ...((persisted as { prefs?: Partial<NotifPrefs> } | undefined)?.prefs ?? {}),
        },
      }),
      onRehydrateStorage: () => () => useNotifPrefs.setState({ hydrated: true }),
    }
  )
);
