// Toast: el acuse efímero de una acción. Un solo mensaje a la vez.
//
// No hay cola a propósito. Un toast contesta a algo que el usuario ACABA de
// hacer, y encolar mensajes viejos los muestra fuera de contexto: para cuando
// el tercero sale, el usuario ya está en otra pantalla. El último gana.
//
// Tampoco reemplaza a `Alert`: un toast no se puede responder ni bloquea. Lo
// que exija una decisión —borrar un vehículo, elegir entre dos marcas— sigue
// siendo un Alert. Esto es para "se guardó" y "no se pudo guardar".
import { create } from 'zustand';

export type ToastKind = 'ok' | 'error' | 'info';

export type Toast = {
  /** Cambia con cada mensaje: la vista lo usa de `key` para reanimar la entrada. */
  id: number;
  kind: ToastKind;
  text: string;
  /** Fase de salida: sigue montado, pero animándose hacia afuera. */
  saliendo: boolean;
};

/**
 * Un error se lee más despacio que una confirmación, y además suele traer algo
 * que hacer al respecto. "Guardado" se entiende de un vistazo.
 */
const DURACION: Record<ToastKind, number> = {
  ok: 2600,
  info: 3200,
  error: 5000,
};

/** Lo que tarda la animación de salida antes de desmontar. */
export const SALIDA_MS = 200;

type ToastStore = {
  toast: Toast | null;
  show: (text: string, kind?: ToastKind) => void;
  /** Cierra el actual con su animación. Lo llama el toque sobre el toast. */
  hide: () => void;
};

let seq = 0;

export const useToast = create<ToastStore>((set, get) => {
  // Los dos temporizadores viven fuera del estado: no se pintan, y meterlos
  // dentro obligaría a re-renderizar cada vez que cambian. Se limpian SIEMPRE
  // antes de armar otros — si no, el toast nuevo hereda el cierre del viejo y
  // se va de pantalla a los 200 ms de aparecer.
  let aOcultar: ReturnType<typeof setTimeout> | null = null;
  let aDesmontar: ReturnType<typeof setTimeout> | null = null;

  const limpiar = () => {
    if (aOcultar) clearTimeout(aOcultar);
    if (aDesmontar) clearTimeout(aDesmontar);
    aOcultar = null;
    aDesmontar = null;
  };

  const cerrar = () => {
    limpiar();
    if (!get().toast) return;
    set((s) => (s.toast ? { toast: { ...s.toast, saliendo: true } } : s));
    aDesmontar = setTimeout(() => set({ toast: null }), SALIDA_MS);
  };

  return {
    toast: null,

    show: (text, kind = 'ok') => {
      limpiar();
      set({ toast: { id: ++seq, kind, text, saliendo: false } });
      aOcultar = setTimeout(cerrar, DURACION[kind]);
    },

    hide: cerrar,
  };
});

/**
 * Atajo imperativo, para usarlo fuera de un componente.
 *
 * `useToast.getState()` no se suscribe a nada, así que llamarlo desde un
 * `onPress` o un catch no provoca re-render de quien lo llama.
 */
export const toast = {
  ok: (text: string) => useToast.getState().show(text, 'ok'),
  error: (text: string) => useToast.getState().show(text, 'error'),
  info: (text: string) => useToast.getState().show(text, 'info'),
};
