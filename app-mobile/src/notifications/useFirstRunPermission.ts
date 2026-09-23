// Pide el permiso de notificaciones la primera vez que el usuario entra a la
// app (al montar Tabs, venga de Login o de Signup). Diálogo nativo directo,
// sin pantalla previa.
//
// Se ejecuta UNA sola vez en la vida de la instalación: `permissionAskedAt`
// está persistido. En iOS eso es obligatorio — el sistema solo muestra el
// diálogo una vez; después, la única vía es openSystemSettings().
import { useEffect } from 'react';
import { useNotifPrefs } from '../store/notifPrefs';
import { requestPermission } from './permissions';
import { registrarDispositivo } from './push';

export function useFirstRunPermission(): void {
  useEffect(() => {
    let cancelled = false;

    const ask = async () => {
      const { permissionAskedAt, hydrated, markPermissionAsked, setPref } =
        useNotifPrefs.getState();
      if (!hydrated || permissionAskedAt !== null) return;

      const state = await requestPermission();
      if (cancelled) return;

      markPermissionAsked();
      void setPref('enabled', state === 'granted');
      // Registra el token AQUÍ y no solo al arrancar: cuando App.tsx lo
      // intentó, este diálogo no se había mostrado todavía y sin permiso no
      // hay token que pedir. Sin esta línea, el dispositivo no quedaría
      // registrado hasta el siguiente arranque de la app.
      void registrarDispositivo();
    };

    void ask();
    // Si el store aún no había rehidratado al montar, reintentar cuando lo haga.
    const unsub = useNotifPrefs.subscribe(() => void ask());

    return () => {
      cancelled = true;
      unsub();
    };
  }, []);
}
