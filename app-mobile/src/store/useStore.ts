// Perfil y suscripción. La FLOTA ya no vive acá: se mudó a useVehicles, que
// la trae del backend con caché local y cola de escrituras.
//
// El perfil es una copia del usuario autenticado (ver setProfile). El plan y
// su consumo se mudaron a store/suscripcion, que los trae del backend.
import { create } from 'zustand';
import type { Profile } from '../data/mock';
import type { ApiUser as AuthUser } from '../api/controllers/auth.controller';

// Acá vivían kmLeft, oilPct y vehicleStatus.
//
// Se fueron al backend: la vida del aceite corre por dos ejes —kilómetros y
// tiempo— y eso necesita la fecha del cambio y `now()`, no solo una resta de
// odómetros. Mantenerlos acá además significaba tener DOS definiciones del
// mismo estado: OilGauge cortaba en 15% y este archivo en 0%, así que el
// mismo vehículo al 10% se pintaba rojo en el medidor y amarillo en la lista.
//
// Ahora el número llega en `vehicle.gauge` (ver useVehicles) y hay una sola
// definición en todo el producto.

type Store = {
  profile: Profile;

  // Acá había un `updateProfile` que escribía el perfil en local. Se fue a
  // useAuth, que es donde vive el usuario de verdad: ahora editar el perfil
  // es una llamada al backend, y el perfil de este store se repinta solo con
  // lo que responde el servidor (ver el efecto de App.tsx). Tener las dos
  // cosas dejaba escribir el perfil sin que el servidor se enterara.

  /** Vuelca el usuario autenticado sobre el perfil, al arrancar la sesión y
   *  después de cada edición. Con `null` (sesión cerrada) lo vacía. */
  setProfile: (u: AuthUser | null) => void;
};

/** El perfil antes de que llegue el usuario. Vacío a propósito: arrancar con
 *  el mock hacía que la app mostrara por un instante a "Luis Guerrero" antes
 *  del nombre real, y que al cerrar sesión quedara el perfil del anterior. */
export const EMPTY_PROFILE: Profile = {
  fullName: '',
  cedula: '',
  email: '',
  phone: '',
  state: '',
  city: '',
  currency: 'USD',
};

export const useStore = create<Store>((set) => ({
  profile: EMPTY_PROFILE,

  // El registro ya pide estado y ciudad, así que para las cuentas nuevas
  // siempre vienen. Las creadas antes los tienen en null, y ahí se muestra
  // vacío a propósito: rellenar el hueco con el mock hacía que el usuario
  // leyera una ciudad que nunca escribió, como si fuera suya.
  setProfile: (u) =>
    set(() => ({
      profile: !u ? EMPTY_PROFILE : {
        fullName: u.fullName,
        cedula: u.cedula,
        email: u.email,
        phone: u.phone,
        state: u.state ?? '',
        city: u.city ?? '',
        currency: u.currency,
      },
    })),
}));

// useActiveVehicle y useOpenAlerts se mudaron a useVehicles: son selectores
// de la flota, y la flota ya no vive acá.
