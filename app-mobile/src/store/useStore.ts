// Estado global (Zustand). Offline-first: por ahora data mock en memoria;
// la persistencia (MMKV/AsyncStorage) y el backend vienen después.
import { create } from 'zustand';
import {
  MOCK_CHANGES,
  MOCK_FLEET,
  MOCK_PROFILE,
  MOCK_SUBSCRIPTION,
  OilChange,
  PLANS,
  Plan,
  Profile,
  Subscription,
  Vehicle,
  VehicleStatus,
} from '../data/mock';
import type { ApiUser as AuthUser } from '../api/controllers/auth.controller';

// Computed selectors del README
export const kmLeft = (v: Vehicle) => v.nextChange - v.km;
export const oilPct = (v: Vehicle) =>
  Math.round(((v.nextChange - v.km) / (v.nextChange - v.lastChange)) * 100);
export const vehicleStatus = (v: Vehicle): VehicleStatus => {
  const pct = oilPct(v);
  return pct > 40 ? 'ok' : pct > 0 ? 'warn' : 'danger';
};

type Store = {
  vehicles: Vehicle[];
  changes: OilChange[];
  profile: Profile;
  subscription: Subscription;
  activeVehicleId: string;

  setActiveVehicle: (id: string) => void;
  addVehicle: (v: Omit<Vehicle, 'id'>) => string;
  addOilChange: (c: Omit<OilChange, 'id'>) => void;
  /** Parcial a propósito: la pantalla de editar manda solo lo que tocó. */
  updateProfile: (patch: Partial<Profile>) => void;
  /** Vuelca el usuario autenticado sobre el perfil, al arrancar la sesión. */
  setProfileFromUser: (u: AuthUser) => void;
  /** Editar un vehículo. No toca `oil` ni el historial: eso se cambia
   *  registrando un cambio de aceite, no editando la ficha. */
  updateVehicle: (id: string, patch: Partial<Omit<Vehicle, 'id'>>) => void;
  /** Borra el vehículo y, con él, su historial: dejar cambios huérfanos
   *  apuntando a un id que ya no existe rompe todas las vistas que los cruzan. */
  removeVehicle: (id: string) => void;
};

export const useStore = create<Store>((set, get) => ({
  vehicles: MOCK_FLEET,
  changes: MOCK_CHANGES,
  profile: MOCK_PROFILE,
  subscription: MOCK_SUBSCRIPTION,
  activeVehicleId: MOCK_FLEET[0].id,

  setActiveVehicle: (id) => set({ activeVehicleId: id }),

  updateProfile: (patch) => set((s) => ({ profile: { ...s.profile, ...patch } })),

  // El registro no pide estado ni ciudad, así que llegan nulos: se conserva lo
  // que ya hubiera en vez de borrarlo con un vacío.
  setProfileFromUser: (u) =>
    set((s) => ({
      profile: {
        ...s.profile,
        fullName: u.fullName,
        cedula: u.cedula,
        email: u.email,
        phone: u.phone,
        state: u.state ?? s.profile.state,
        city: u.city ?? s.profile.city,
        currency: u.currency,
      },
    })),

  updateVehicle: (id, patch) =>
    set((s) => ({ vehicles: s.vehicles.map((v) => (v.id === id ? { ...v, ...patch } : v)) })),

  removeVehicle: (id) =>
    set((s) => {
      const vehicles = s.vehicles.filter((v) => v.id !== id);
      return {
        vehicles,
        changes: s.changes.filter((ch) => ch.vehicleId !== id),
        // Si se borró el activo hay que mover el puntero: si no, el inicio se
        // queda pidiendo un vehículo que ya no está.
        activeVehicleId:
          s.activeVehicleId === id ? (vehicles[0]?.id ?? '') : s.activeVehicleId,
      };
    }),

  addVehicle: (v) => {
    const id = `v${Date.now()}`;
    set((s) => ({ vehicles: [...s.vehicles, { ...v, id }] }));
    return id;
  },

  addOilChange: (c) => {
    const id = `c${Date.now()}`;
    set((s) => ({
      changes: [{ ...c, id }, ...s.changes],
      vehicles: s.vehicles.map((v) =>
        v.id === c.vehicleId
          ? {
              ...v,
              km: Math.max(v.km, c.km),
              lastChange: c.km,
              nextChange: c.km + (v.nextChange - v.lastChange),
              daysSince: 0,
              oil: { ...c.oil, synthetic: v.oil.synthetic },
            }
          : v
      ),
    }));
  },
}));

export const useActiveVehicle = () =>
  useStore((s) => s.vehicles.find((v) => v.id === s.activeVehicleId) ?? s.vehicles[0]);

export const useOpenAlerts = () =>
  useStore((s) => s.vehicles.filter((v) => vehicleStatus(v) !== 'ok').length);

/** El plan contratado, ya resuelto: las pantallas leen topes y nombre de acá
 *  en vez de repetir el `PLANS[sub.plan]` cada una. */
export const usePlan = (): Plan => useStore((s) => PLANS[s.subscription.plan]);

/** Consumo contra los topes del plan. Lo calcula el store y no cada pantalla:
 *  el perfil y el detalle del plan muestran exactamente los mismos números. */
export const usePlanUsage = () => {
  const plan = usePlan();
  const vehicles = useStore((s) => s.vehicles.length);
  const changesThisMonth = useStore((s) => s.subscription.changesThisMonth);

  return [
    { k: 'Vehículos', usado: vehicles, tope: plan.maxVehicles },
    { k: 'Cambios este mes', usado: changesThisMonth, tope: plan.maxChangesPerMonth },
  ];
};
