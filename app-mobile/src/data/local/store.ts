// Persistencia local de la flota, la cola y los bloques de estado.
//
// Usa el mismo almacén que el layout del inicio (expo-sqlite/kv-store), así no
// se suma una dependencia más por algo que ya está resuelto en el proyecto.
//
// Todas las lecturas devuelven el vacío ante cualquier problema, en vez de
// propagar el error: un almacenamiento corrupto no puede ser una pantalla en
// blanco. Es el mismo criterio que `reconcile` aplica al layout.
import AsyncStorage from 'expo-sqlite/kv-store';
import type { ApiVehicle } from '../../api/controllers/vehicles.controller';
import type { OilStatusResponse } from '../../api/controllers/oil-status.controller';
import type { ApiBrand } from '../../api/controllers/brands.controller';
import type { ApiColor } from '../../api/controllers/colors.controller';
import type { VehicleKind } from '../types';
import type { QueueEntry } from '../sync/queue';

const CLAVE_FLOTA = 'ruedalo:flota';
const CLAVE_COLA = 'ruedalo:cola';
const claveEstado = (vehicleId: string) => `ruedalo:estado:${vehicleId}`;
const CLAVE_MARCAS = 'ruedalo:marcas';
const CLAVE_COLA_MARCAS = 'ruedalo:cola-marcas';
const CLAVE_COLORES = 'ruedalo:colores';

async function leerJson<T>(clave: string, siFalla: T): Promise<T> {
  try {
    const crudo = await AsyncStorage.getItem(clave);
    if (crudo === null) return siFalla;
    return JSON.parse(crudo) as T;
  } catch {
    return siFalla;
  }
}

async function guardarJson(clave: string, valor: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(clave, JSON.stringify(valor));
  } catch {
    // Quedarse sin espacio no puede tumbar un guardado que en memoria ya
    // ocurrió: la UI sigue correcta y el próximo intento persiste.
  }
}

export async function guardarFlota(vehiculos: ApiVehicle[]): Promise<void> {
  await guardarJson(CLAVE_FLOTA, vehiculos);
}

export async function leerFlota(): Promise<ApiVehicle[]> {
  const v = await leerJson<unknown>(CLAVE_FLOTA, []);
  // No basta con que el JSON parsee: una versión vieja pudo guardar otra
  // forma, y un `.map` sobre un objeto revienta la pantalla.
  return Array.isArray(v) ? (v as ApiVehicle[]) : [];
}

export async function guardarCola(cola: QueueEntry[]): Promise<void> {
  await guardarJson(CLAVE_COLA, cola);
}

export async function leerCola(): Promise<QueueEntry[]> {
  const c = await leerJson<unknown>(CLAVE_COLA, []);
  return Array.isArray(c) ? (c as QueueEntry[]) : [];
}

export async function guardarEstado(
  vehicleId: string,
  bloque: OilStatusResponse,
): Promise<void> {
  await guardarJson(claveEstado(vehicleId), bloque);
}

export async function leerEstado(
  vehicleId: string,
): Promise<OilStatusResponse | null> {
  return leerJson<OilStatusResponse | null>(claveEstado(vehicleId), null);
}

export type MarcasPorTipo = Record<VehicleKind, ApiBrand[]>;

const MARCAS_VACIAS: MarcasPorTipo = { car: [], moto: [] };

export async function guardarMarcas(m: MarcasPorTipo): Promise<void> {
  await guardarJson(CLAVE_MARCAS, m);
}

export async function leerMarcas(): Promise<MarcasPorTipo> {
  const m = await leerJson<unknown>(CLAVE_MARCAS, MARCAS_VACIAS);
  // Mismo criterio que leerFlota: que el JSON parsee no garantiza la forma.
  // Una versión vieja pudo guardar otra cosa, y un `.map` sobre eso revienta
  // el selector de marcas justo en el paso 2 del alta.
  if (typeof m !== 'object' || m === null) return MARCAS_VACIAS;
  const cand = m as Partial<MarcasPorTipo>;
  return {
    car: Array.isArray(cand.car) ? cand.car : [],
    moto: Array.isArray(cand.moto) ? cand.moto : [],
  };
}

export async function guardarColaMarcas(cola: QueueEntry[]): Promise<void> {
  await guardarJson(CLAVE_COLA_MARCAS, cola);
}

export async function leerColaMarcas(): Promise<QueueEntry[]> {
  const c = await leerJson<unknown>(CLAVE_COLA_MARCAS, []);
  return Array.isArray(c) ? (c as QueueEntry[]) : [];
}

export async function guardarColores(colores: ApiColor[]): Promise<void> {
  await guardarJson(CLAVE_COLORES, colores);
}

export async function leerColores(): Promise<ApiColor[]> {
  const c = await leerJson<unknown>(CLAVE_COLORES, []);
  return Array.isArray(c) ? (c as ApiColor[]) : [];
}
