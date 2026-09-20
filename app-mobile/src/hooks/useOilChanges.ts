// El historial de un vehículo. Trae la primera página al enfocar y sabe pedir
// la siguiente; `nextCursor` en null es lo que corta la paginación.
import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  vehiclesController,
  type ApiOilChange,
} from '../api/controllers/vehicles.controller';

export function useOilChanges(vehicleId: string | null, limit = 20) {
  const [items, setItems] = useState<ApiOilChange[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  const primeraPagina = useCallback(async () => {
    if (!vehicleId) return;
    setCargando(true);
    try {
      const p = await vehiclesController.historial(vehicleId, { limit });
      setItems(p.items);
      setCursor(p.nextCursor);
    } catch {
      // Sin señal se conserva lo que ya había en pantalla.
    } finally {
      setCargando(false);
    }
  }, [vehicleId, limit]);

  const siguientePagina = useCallback(async () => {
    if (!vehicleId || cursor === null || cargando) return;
    setCargando(true);
    try {
      const p = await vehiclesController.historial(vehicleId, {
        cursor,
        limit,
      });
      setItems((previos) => [...previos, ...p.items]);
      setCursor(p.nextCursor);
    } catch {
      // Ídem: la página que falta se vuelve a pedir al scrollear de nuevo.
    } finally {
      setCargando(false);
    }
  }, [vehicleId, cursor, cargando, limit]);

  useFocusEffect(
    useCallback(() => {
      void primeraPagina();
    }, [primeraPagina]),
  );

  return {
    items,
    cargando,
    hayMas: cursor !== null,
    recargar: primeraPagina,
    siguientePagina,
  };
}
