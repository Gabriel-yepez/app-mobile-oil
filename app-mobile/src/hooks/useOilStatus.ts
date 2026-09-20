// El bloque de estado de un vehículo, con caché local.
//
// Se recarga al enfocar la pantalla y no en cada render: el bloque cambia con
// el tiempo, pero no tan rápido como para justificar un poll — y `computedAt`
// deja ver cuándo se calculó, que es lo que la tarjeta muestra cuando el dato
// quedó viejo por falta de señal.
import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  oilStatusController,
  type OilStatusResponse,
} from '../api/controllers/oil-status.controller';
import { guardarEstado, leerEstado } from '../data/local/store';

/** Pasadas las 24 h el número deja de ser "de ahora" y se dice. */
const HORAS_HASTA_VIEJO = 24;

export function useOilStatus(vehicleId: string | null) {
  const [data, setData] = useState<OilStatusResponse | null>(null);
  const [error, setError] = useState<unknown>(null);

  // Hidratar de local: la tarjeta pinta antes de que responda la red.
  useEffect(() => {
    let vigente = true;
    setData(null);
    if (!vehicleId) return;
    void leerEstado(vehicleId).then((r) => {
      if (vigente && r) setData(r);
    });
    return () => {
      vigente = false;
    };
  }, [vehicleId]);

  const load = useCallback(async () => {
    if (!vehicleId) return;
    try {
      const r = await oilStatusController.status(vehicleId);
      setData(r);
      setError(null);
      void guardarEstado(vehicleId, r);
    } catch (e) {
      // Offline-first: si falla, se conserva lo último que llegó. La tarjeta
      // ya sabe marcarlo como viejo mirando computedAt.
      setError(e);
    }
  }, [vehicleId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  /** La usa la pantalla de lectura manual: el POST ya devuelve el bloque
   *  recalculado, así que no hace falta un GET extra. */
  const replace = useCallback(
    (r: OilStatusResponse) => {
      setData(r);
      if (vehicleId) void guardarEstado(vehicleId, r);
    },
    [vehicleId],
  );

  const horasDeAntiguedad = data
    ? (Date.now() - new Date(data.computedAt).getTime()) / 3_600_000
    : 0;

  return {
    data,
    error,
    reload: load,
    replace,
    /** true cuando el bloque quedó viejo: la tarjeta lo dice en vez de
     *  mostrar el número como si fuera de ahora. */
    viejo: data !== null && horasDeAntiguedad > HORAS_HASTA_VIEJO,
    horasDeAntiguedad,
  };
}
