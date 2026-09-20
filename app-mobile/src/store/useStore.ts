// Perfil y suscripción. La FLOTA ya no vive acá: se mudó a useVehicles, que
// la trae del backend con caché local y cola de escrituras.
//
// Lo que queda todavía es mock (MOCK_PROFILE, MOCK_SUBSCRIPTION); el perfil se
// pisa con el usuario real al iniciar sesión, y la suscripción espera su
// propia tanda.
import { create } from 'zustand';
import {
  MOCK_PROFILE,
  MOCK_SUBSCRIPTION,
  PLANS,
  Plan,
  Profile,
  Subscription,
} from '../data/mock';
import type { ApiUser as AuthUser } from '../api/controllers/auth.controller';
import { useVehicles } from './useVehicles';

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
  subscription: Subscription;

  // Acá había un `updateProfile` que escribía el perfil en local. Se fue a
  // useAuth, que es donde vive el usuario de verdad: ahora editar el perfil
  // es una llamada al backend, y el perfil de este store se repinta solo con
  // lo que responde el servidor (ver el efecto de App.tsx). Tener las dos
  // cosas dejaba escribir el perfil sin que el servidor se enterara.

  /** Vuelca el usuario autenticado sobre el perfil, al arrancar la sesión y
   *  después de cada edición. */
  setProfileFromUser: (u: AuthUser) => void;
};

export const useStore = create<Store>((set) => ({
  profile: MOCK_PROFILE,
  subscription: MOCK_SUBSCRIPTION,

  // El registro ya pide estado y ciudad, así que para las cuentas nuevas
  // siempre vienen. Las creadas antes los tienen en null, y ahí se muestra
  // vacío a propósito: rellenar el hueco con el mock hacía que el usuario
  // leyera una ciudad que nunca escribió, como si fuera suya.
  setProfileFromUser: (u) =>
    set((s) => ({
      profile: {
        ...s.profile,
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

/** El plan contratado, ya resuelto: las pantallas leen topes y nombre de acá
 *  en vez de repetir el `PLANS[sub.plan]` cada una. */
export const usePlan = (): Plan => useStore((s) => PLANS[s.subscription.plan]);

/** Consumo contra los topes del plan. Lo calcula el store y no cada pantalla:
 *  el perfil y el detalle del plan muestran exactamente los mismos números. */
export const usePlanUsage = () => {
  const plan = usePlan();
  const vehicles = useVehicles((s) => s.vehicles.length);
  const changesThisMonth = useStore((s) => s.subscription.changesThisMonth);

  return [
    { k: 'Vehículos', usado: vehicles, tope: plan.maxVehicles },
    { k: 'Cambios este mes', usado: changesThisMonth, tope: plan.maxChangesPerMonth },
  ];
};
