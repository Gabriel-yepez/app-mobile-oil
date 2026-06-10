// Data mock — espejo de MY_FLEET / VE_BRANDS / VE_OILS / SHOPS_VE del handoff.
// Más adelante esto se reemplaza por el backend.

export type VehicleStatus = 'ok' | 'warn' | 'danger';

export type Vehicle = {
  id: string;
  kind: 'car' | 'moto';
  brand: string;
  model: string;
  year: number;
  plate: string;
  color: string; // hex
  km: number;
  oil: { brand: string; tag: string; viscosity: string; synthetic: boolean };
  lastChange: number; // km
  nextChange: number; // km
  daysSince: number;
};

export type OilChange = {
  id: string;
  vehicleId: string;
  date: string; // legible es-VE p.ej. "08 feb 2026"
  km: number;
  oil: { brand: string; tag: string; viscosity: string };
  shop: string;
  costUsd: number;
};

export type Profile = {
  fullName: string;
  cedula: string;
  email: string;
  phone: string;
  state: string;
  city: string;
  currency: 'USD' | 'BS' | 'BOTH';
};

export const VE_BRANDS_CAR = ['Toyota', 'Chevrolet', 'Ford', 'Hyundai', 'Kia', 'Renault', 'Fiat', 'Jeep', 'Nissan', 'Mitsubishi'];
export const VE_BRANDS_MOTO = ['Bera', 'Empire Keeway', 'MD', 'Yamaha', 'Suzuki', 'Honda', 'AVA', 'Skygo'];

export const VE_OILS = [
  { brand: 'Pennzoil', tag: 'Platinum', viscosity: '5W-30', synthetic: true },
  { brand: 'Valvoline', tag: 'MaxLife', viscosity: '10W-40', synthetic: true },
  { brand: 'Mobil 1', tag: 'ESP', viscosity: '5W-30', synthetic: true },
  { brand: 'Castrol', tag: 'GTX', viscosity: '20W-50', synthetic: false },
  { brand: 'Shell Helix', tag: 'HX7', viscosity: '10W-40', synthetic: true },
  { brand: 'PDV', tag: 'Súper', viscosity: '20W-50', synthetic: false },
];

export const VISCOSITIES = ['5W-30', '10W-40', '20W-50', '0W-20'];

export const SHOPS_VE = [
  'Lubricantes El Marqués',
  'Servicar Las Mercedes',
  'Tecnicentro Cordero',
  'Auto Express La Castellana',
  'Lubricantes Sambil',
  'Mecánica La Trinidad',
];

export const MOCK_FLEET: Vehicle[] = [
  {
    id: 'v1',
    kind: 'car',
    brand: 'Toyota',
    model: 'Corolla XEI',
    year: 2019,
    plate: 'AC123BD',
    km: 78460,
    color: '#1F2937',
    oil: { brand: 'Pennzoil', tag: 'Platinum', viscosity: '5W-30', synthetic: true },
    lastChange: 73000,
    nextChange: 80300,
    daysSince: 92,
  },
  {
    id: 'v2',
    kind: 'car',
    brand: 'Chevrolet',
    model: 'Aveo LT',
    year: 2014,
    plate: 'GR891NM',
    km: 142180,
    color: '#9CA3AF',
    oil: { brand: 'Valvoline', tag: 'MaxLife', viscosity: '10W-40', synthetic: true },
    lastChange: 138000,
    nextChange: 143000,
    daysSince: 145,
  },
  {
    id: 'v3',
    kind: 'moto',
    brand: 'Bera',
    model: 'BR-200',
    year: 2022,
    plate: 'AAB12P',
    km: 18250,
    color: '#DC2626',
    oil: { brand: 'Mobil 1', tag: 'ESP', viscosity: '10W-40', synthetic: true },
    lastChange: 17000,
    nextChange: 20000,
    daysSince: 42,
  },
];

export const MOCK_CHANGES: OilChange[] = [
  { id: 'c1', vehicleId: 'v1', date: '08 feb 2026', km: 73000, oil: { brand: 'Pennzoil', tag: 'Platinum', viscosity: '5W-30' }, shop: 'Lubricantes El Marqués', costUsd: 32 },
  { id: 'c2', vehicleId: 'v3', date: '14 ene 2026', km: 17000, oil: { brand: 'Mobil 1', tag: 'ESP', viscosity: '10W-40' }, shop: 'Tecnicentro Cordero', costUsd: 18 },
  { id: 'c3', vehicleId: 'v2', date: '02 dic 2025', km: 138000, oil: { brand: 'Valvoline', tag: 'MaxLife', viscosity: '10W-40' }, shop: 'Servicar Las Mercedes', costUsd: 28 },
  { id: 'c4', vehicleId: 'v1', date: '21 oct 2025', km: 67800, oil: { brand: 'Pennzoil', tag: 'Platinum', viscosity: '5W-30' }, shop: 'Servicar Las Mercedes', costUsd: 28 },
  { id: 'c5', vehicleId: 'v3', date: '04 sep 2025', km: 14200, oil: { brand: 'Mobil 1', tag: 'ESP', viscosity: '10W-40' }, shop: 'Tecnicentro Cordero', costUsd: 16.5 },
  { id: 'c6', vehicleId: 'v2', date: '18 jul 2025', km: 132400, oil: { brand: 'Castrol', tag: 'GTX', viscosity: '20W-50' }, shop: 'Lubricantes El Marqués', costUsd: 22 },
  { id: 'c7', vehicleId: 'v1', date: '14 may 2025', km: 62100, oil: { brand: 'Castrol', tag: 'GTX', viscosity: '20W-50' }, shop: 'Lubricantes El Marqués', costUsd: 25 },
];

export const MOCK_PROFILE: Profile = {
  fullName: 'Luis Guerrero',
  cedula: 'V-25.481.073',
  email: 'luis.guerrero@gmail.com',
  phone: '+58 414 528 9012',
  state: 'Distrito Capital',
  city: 'Caracas',
  currency: 'BOTH',
};

// Tasa mock USD → Bs.S para la conversión secundaria
export const BS_RATE = 36.54;

// Mini bar chart "Inversión 2026" (12 meses)
export const SPEND_BARS = [24, 18, 32, 14, 28, 36, 12, 22, 30, 28, 18, 26];
