// Tasa oficial del BCV, para mostrar montos en Bs.S al lado del USD.
//
// Se persiste en el teléfono, a diferencia de las preferencias de
// notificación: no es un dato de la cuenta sino una referencia pública, y
// guardarla es lo que deja mostrar la conversión sin señal.
import AsyncStorage from 'expo-sqlite/kv-store';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  exchangeRateController,
  type ApiExchangeRate,
} from '../api/controllers/exchange-rate.controller';

type TasaBcvStore = {
  /** null hasta la primera carga: sin tasa se oculta la conversión en vez de
   *  inventar un número, que es lo que hacía la constante del mock. */
  tasa: ApiExchangeRate | null;
  cargar: () => Promise<void>;
};

export const useTasaBcv = create<TasaBcvStore>()(
  persist(
    (set) => ({
      tasa: null,

      // Sin estado de "cargando": no hay nada que mostrar mientras llega, y
      // pedirla en cada foco es barato porque el servidor la tiene en caché.
      cargar: async () => {
        try {
          set({ tasa: await exchangeRateController.bcv() });
        } catch {
          // Sin red o con el proveedor caído, la última conocida sigue valiendo.
        }
      },
    }),
    {
      name: 'ruedalo:tasa-bcv',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ tasa: s.tasa }),
    }
  )
);
