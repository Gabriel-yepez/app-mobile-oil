// El historial de TODA la flota, para la pantalla de Historial y el widget de
// recientes.
//
// El endpoint es por vehículo, así que acá se piden en paralelo y se juntan
// ordenados por fecha. Es una llamada por vehículo: aceptable con los topes
// actuales (el plan gratis son 5), pero si el plan Pro trae flotas grandes,
// lo correcto es un endpoint que cruce los vehículos del usuario, no seguir
// sumando peticiones acá.
import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  vehiclesController,
  type ApiOilChange,
} from '../api/controllers/vehicles.controller';
import { useVehicles } from '../store/useVehicles';

export function useAllOilChanges(limitPorVehiculo = 20) {
  const vehicles = useVehicles((s) => s.vehicles);
  const [items, setItems] = useState<ApiOilChange[]>([]);
  const [cargando, setCargando] = useState(false);

  const ids = vehicles.map((v) => v.id).join(',');

  const cargar = useCallback(async () => {
    if (!ids) {
      setItems([]);
      return;
    }
    setCargando(true);
    try {
      const paginas = await Promise.all(
        ids
          .split(',')
          .map((id) =>
            vehiclesController
              .historial(id, { limit: limitPorVehiculo })
              // Que un vehículo falle no puede vaciar el historial de los
              // otros: se devuelve su página vacía y el resto se muestra.
              .catch(() => ({ items: [], nextCursor: null })),
          ),
      );

      setItems(
        paginas
          .flatMap((p) => p.items)
          .sort((a, b) => b.changedAt.localeCompare(a.changedAt)),
      );
    } finally {
      setCargando(false);
    }
  }, [ids, limitPorVehiculo]);

  useFocusEffect(
    useCallback(() => {
      void cargar();
    }, [cargar]),
  );

  return { items, cargando, recargar: cargar };
}
