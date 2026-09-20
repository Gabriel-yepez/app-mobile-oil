// El catálogo de colores de vehículo.
//
// Solo lectura: nadie escribe colores, así que no hay cola ni operaciones
// pendientes. Es el mismo ciclo que la flota y las marcas, menos la mitad de
// escritura: hidrata del disco, pinta, refresca, guarda.
import { useMemo } from 'react';
import { create } from 'zustand';
import { colorsController } from '../api/controllers/colors.controller';
import type { ApiColor } from '../api/controllers/colors.controller';
import { guardarColores, leerColores } from '../data/local/store';

/**
 * Los mismos diez que sirve el backend. Están acá para que una instalación
 * nueva sin señal no abra el selector vacío; la lista del servidor los pisa en
 * el primer refresco.
 *
 * Si cambiás uno, cambialo también en
 * `backend-oil-app/src/modules/colors/domain/vehicle-color.ts`.
 */
const SEMILLA: ApiColor[] = [
  { name: 'Negro', hex: '#1F2937' },
  { name: 'Gris', hex: '#9CA3AF' },
  { name: 'Plata', hex: '#D1D5DB' },
  { name: 'Blanco', hex: '#F3F4F6' },
  { name: 'Rojo', hex: '#DC2626' },
  { name: 'Vinotinto', hex: '#7F1D1D' },
  { name: 'Azul', hex: '#2563EB' },
  { name: 'Verde', hex: '#059669' },
  { name: 'Amarillo', hex: '#FACC15' },
  { name: 'Beige', hex: '#D6C7A8' },
];

type Estado = {
  colores: ApiColor[];
  hydrated: boolean;
  hidratar: () => Promise<void>;
  refresh: () => Promise<void>;
};

export const useColors = create<Estado>((set) => ({
  colores: SEMILLA,
  hydrated: false,

  hidratar: async () => {
    const colores = await leerColores();
    set({ colores: colores.length > 0 ? colores : SEMILLA, hydrated: true });
  },

  refresh: async () => {
    const colores = await colorsController.listar();
    // Una lista vacía del servidor no puede dejar el selector sin opciones:
    // sería un formulario imposible de completar.
    if (colores.length === 0) return;
    set({ colores });
    void guardarColores(colores);
  },
}));

/**
 * El color guardado en el vehículo, resuelto contra el catálogo.
 *
 * Devuelve `null` cuando ese hex ya no está en el catálogo. Antes esto se
 * resolvía con `Math.max(0, findIndex(...))`, que mostraba NEGRO en silencio:
 * un vehículo verde se veía negro y al guardar se volvía negro de verdad. Con
 * un catálogo que puede cambiar, eso pasa de improbable a esperable.
 */
export const useColorDe = (hex: string): ApiColor | null => {
  const colores = useColors((s) => s.colores);
  return useMemo(
    () => colores.find((c) => c.hex.toUpperCase() === hex.toUpperCase()) ?? null,
    [colores, hex],
  );
};
