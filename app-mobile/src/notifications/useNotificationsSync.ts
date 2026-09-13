// Cuándo se reconcilia. Tres disparadores, todos convergiendo en la misma
// función idempotente con debounce.
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useStore } from '../store/useStore';
import { useNotifPrefs } from '../store/notifPrefs';
import { syncNotifications } from './scheduler';

const DEBOUNCE_MS = 300;

export function useNotificationsSync(): void {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const run = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        // Antes de rehidratar, `prefs` son los valores por defecto: programar
        // ahora pisaría lo que el usuario ya había configurado.
        if (!useNotifPrefs.getState().hydrated) return;
        void syncNotifications();
      }, DEBOUNCE_MS);
    };

    run();

    // Volver de segundo plano: cubre que el usuario haya revocado el permiso
    // desde los ajustes del teléfono mientras la app no estaba en pantalla.
    const appState = AppState.addEventListener('change', (s) => {
      if (s === 'active') run();
    });

    // Cambios de datos: addOilChange, addVehicle, switches de preferencias y
    // el flag `hydrated` cuando termina de leerse el almacenamiento.
    const unsubVehicles = useStore.subscribe(run);
    const unsubPrefs = useNotifPrefs.subscribe(run);

    return () => {
      if (timer) clearTimeout(timer);
      appState.remove();
      unsubVehicles();
      unsubPrefs();
    };
  }, []);
}
