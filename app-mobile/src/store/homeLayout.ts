// Layout del inicio — segundo slice persistido de la app (el otro es notifPrefs).
// La lógica vive en src/home/layout.ts; acá solo se guarda y se rehidrata.
import AsyncStorage from 'expo-sqlite/kv-store';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  DEFAULT_LAYOUT,
  HomeLayout,
  WidgetId,
  moveWidget,
  reconcile,
  toggleWidget,
} from '../home/layout';

type HomeLayoutStore = {
  layout: HomeLayout;
  /** false hasta que termina de leerse el almacenamiento. El inicio espera a
   *  esto para no pintar el layout de fábrica y reordenarse a la vista. */
  hydrated: boolean;
  move: (id: WidgetId, to: number) => void;
  toggle: (id: WidgetId) => void;
  reset: () => void;
};

export const useHomeLayout = create<HomeLayoutStore>()(
  persist(
    (set) => ({
      layout: DEFAULT_LAYOUT,
      hydrated: false,
      move: (id, to) => set((s) => ({ layout: moveWidget(s.layout, id, to) })),
      toggle: (id) => set((s) => ({ layout: toggleWidget(s.layout, id) })),
      reset: () => set({ layout: DEFAULT_LAYOUT }),
    }),
    {
      name: 'oiltrack:home-layout',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ layout: s.layout }),
      // `reconcile` es lo que hace que un widget agregado en una versión futura
      // aparezca en los usuarios que ya tienen layout guardado.
      merge: (persisted, current) => ({
        ...current,
        layout: reconcile((persisted as { layout?: unknown } | undefined)?.layout),
      }),
      onRehydrateStorage: () => () => useHomeLayout.setState({ hydrated: true }),
    }
  )
);
