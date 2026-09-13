// Preferencia de tema — "sistema", "claro" u "oscuro".
//
// Persistida porque es una decisión explícita del usuario: si se perdiera al
// cerrar la app, elegir "oscuro" no serviría de nada.
//
// Guarda la PREFERENCIA, no el esquema resuelto: con 'system' guardado, un
// usuario que cambia el ajuste del teléfono ve cambiar la app; si guardáramos
// 'dark', quedaría clavado en lo que el sistema decía el día que lo eligió.
import AsyncStorage from 'expo-sqlite/kv-store';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type ThemePref = 'system' | 'light' | 'dark';

export const THEME_LABEL: Record<ThemePref, string> = {
  system: 'Sistema',
  light: 'Claro',
  dark: 'Oscuro',
};

type ThemePrefStore = {
  pref: ThemePref;
  /** false hasta que termina de leerse el almacenamiento. La app espera a esto
   *  para pintar: sin la espera, un usuario con "oscuro" guardado ve un
   *  parpadeo claro en cada arranque mientras se lee el disco. */
  hydrated: boolean;
  setPref: (pref: ThemePref) => void;
};

export const useThemePref = create<ThemePrefStore>()(
  persist(
    (set) => ({
      pref: 'system',
      hydrated: false,
      setPref: (pref) => set({ pref }),
    }),
    {
      name: 'ruedalo:theme-pref',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ pref: s.pref }),
      // Un valor guardado que ya no existe (o basura) vuelve a 'system' en vez
      // de dejar la app sin tema.
      merge: (persisted, current) => {
        const guardado = (persisted as { pref?: unknown } | undefined)?.pref;
        const valido = guardado === 'light' || guardado === 'dark' || guardado === 'system';
        return { ...current, pref: valido ? guardado : 'system' };
      },
      onRehydrateStorage: () => () => useThemePref.setState({ hydrated: true }),
    }
  )
);
