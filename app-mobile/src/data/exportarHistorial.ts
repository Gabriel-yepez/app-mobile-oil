// Exportar el historial a PDF (plan Pro). Se genera en el teléfono con
// expo-print y se entrega con el menú nativo de compartir: el usuario elige
// si lo manda por correo, WhatsApp o lo guarda en Archivos.
import { printToFileAsync } from 'expo-print';
import { isAvailableAsync, shareAsync } from 'expo-sharing';
import {
  vehiclesController,
  type ApiOilChange,
  type ApiVehicle,
} from '../api/controllers/vehicles.controller';
import { htmlHistorial } from '../utils/historialPdf';

/** El tope de página del backend: menos viajes para un historial largo. */
const POR_PAGINA = 100;

/**
 * TODO el historial visible de esos vehículos, del más nuevo al más viejo.
 * La pantalla trae 20 por vehículo, que alcanza para mirar pero no para un
 * documento que dice ser el historial.
 */
export async function traerHistorialCompleto(vehicleIds: string[]): Promise<ApiOilChange[]> {
  const porVehiculo = await Promise.all(
    vehicleIds.map(async (id) => {
      const todos: ApiOilChange[] = [];
      let cursor: string | undefined;
      do {
        const pagina = await vehiclesController.historial(id, { cursor, limit: POR_PAGINA });
        todos.push(...pagina.items);
        cursor = pagina.nextCursor ?? undefined;
      } while (cursor);
      return todos;
    }),
  );
  return porVehiculo.flat().sort((a, b) => b.changedAt.localeCompare(a.changedAt));
}

type VehiculoPdf = Pick<ApiVehicle, 'id' | 'brand' | 'model' | 'plate'>;

/** Lanza si no hay nada que exportar o si falla la red: la pantalla lo dice. */
export async function exportarHistorialPdf(d: {
  titular: string;
  vehiculos: VehiculoPdf[];
}): Promise<void> {
  const cambios = await traerHistorialCompleto(d.vehiculos.map((v) => v.id));
  if (cambios.length === 0) throw new Error('No hay cambios para exportar.');

  const nombre = new Map(d.vehiculos.map((v) => [v.id, `${v.brand} ${v.model} · ${v.plate}`]));
  const html = htmlHistorial({
    titular: d.titular,
    generado: new Date(),
    filas: cambios.map((c) => ({
      fecha: c.changedAt,
      vehiculo: nombre.get(c.vehicleId) ?? 'Vehículo',
      km: c.km,
      aceite: `${c.oilBrand} ${c.oilTag} ${c.oilViscosity}`.trim(),
      taller: c.shop,
      costoUsd: c.costUsd,
    })),
  });

  const { uri } = await printToFileAsync({ html });
  if (!(await isAvailableAsync())) {
    throw new Error('Este teléfono no permite compartir archivos.');
  }
  await shareAsync(uri, {
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
    dialogTitle: 'Historial de cambios de aceite',
  });
}
