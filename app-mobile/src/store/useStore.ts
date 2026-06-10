// Estado global (Zustand). Offline-first: por ahora data mock en memoria;
// la persistencia (MMKV/AsyncStorage) y el backend vienen después.
import { create } from 'zustand';
import {
  MOCK_CHANGES,
  MOCK_FLEET,
  MOCK_PROFILE,
  OilChange,
  Profile,
  Vehicle,
  VehicleStatus,
} from '../data/mock';

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
  activeVehicleId: string;

  setActiveVehicle: (id: string) => void;
  addVehicle: (v: Omit<Vehicle, 'id'>) => string;
  addOilChange: (c: Omit<OilChange, 'id'>) => void;
};

export const useStore = create<Store>((set, get) => ({
  vehicles: MOCK_FLEET,
  changes: MOCK_CHANGES,
  profile: MOCK_PROFILE,
  activeVehicleId: MOCK_FLEET[0].id,

  setActiveVehicle: (id) => set({ activeVehicleId: id }),

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
