jest.mock('../../api/controllers/vehicles.controller', () => ({
  vehiclesController: { historial: jest.fn() },
}));
jest.mock('expo-print', () => ({ printToFileAsync: jest.fn() }));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(), shareAsync: jest.fn() }));

import { printToFileAsync } from 'expo-print';
import { isAvailableAsync, shareAsync } from 'expo-sharing';
import { vehiclesController } from '../../api/controllers/vehicles.controller';
import type { ApiOilChange } from '../../api/controllers/vehicles.controller';
import { exportarHistorialPdf, traerHistorialCompleto } from '../exportarHistorial';

const historial = vehiclesController.historial as jest.Mock;

const cambio = (id: string, vehicleId: string, changedAt: string): ApiOilChange => ({
  id,
  vehicleId,
  changedAt,
  km: 45_000,
  intervalKm: 5_000,
  intervalMonths: 6,
  oilBrand: 'Pennzoil',
  oilTag: 'Platinum',
  oilViscosity: '5W-30',
  oilSynthetic: true,
  shop: null,
  costUsd: 20,
  resolvedAlert: null,
});

beforeEach(() => jest.clearAllMocks());

describe('traerHistorialCompleto', () => {
  // El historial de la pantalla trae 20 por vehículo; el PDF tiene que tener
  // todo, así que recorre las páginas hasta el final.
  it('recorre todas las páginas de cada vehículo y ordena del más nuevo', async () => {
    historial.mockImplementation((vid: string, opts: { cursor?: string }) => {
      if (vid === 'v1' && !opts.cursor) {
        return Promise.resolve({ items: [cambio('a', 'v1', '2026-09-01')], nextCursor: 'a', hiddenByPlan: 0 });
      }
      if (vid === 'v1') {
        return Promise.resolve({ items: [cambio('b', 'v1', '2025-01-01')], nextCursor: null, hiddenByPlan: 0 });
      }
      return Promise.resolve({ items: [cambio('c', 'v2', '2026-05-01')], nextCursor: null, hiddenByPlan: 0 });
    });

    const todos = await traerHistorialCompleto(['v1', 'v2']);

    expect(todos.map((c) => c.id)).toEqual(['a', 'c', 'b']);
    expect(historial).toHaveBeenCalledWith('v1', { cursor: 'a', limit: 100 });
  });
});

describe('exportarHistorialPdf', () => {
  it('genera el PDF y abre el menú de compartir', async () => {
    historial.mockResolvedValue({ items: [cambio('a', 'v1', '2026-09-01')], nextCursor: null, hiddenByPlan: 0 });
    (printToFileAsync as jest.Mock).mockResolvedValue({ uri: 'file:///historial.pdf', numberOfPages: 1 });
    (isAvailableAsync as jest.Mock).mockResolvedValue(true);

    await exportarHistorialPdf({
      titular: 'Ana Pérez',
      vehiculos: [{ id: 'v1', brand: 'Toyota', model: 'Corolla', plate: 'AB123CD' }],
    });

    expect((printToFileAsync as jest.Mock).mock.calls[0][0].html).toContain('Toyota Corolla · AB123CD');
    expect(shareAsync).toHaveBeenCalledWith(
      'file:///historial.pdf',
      expect.objectContaining({ mimeType: 'application/pdf', UTI: 'com.adobe.pdf' }),
    );
  });

  it('sin nada que exportar no genera un PDF vacío', async () => {
    historial.mockResolvedValue({ items: [], nextCursor: null, hiddenByPlan: 0 });
    await expect(
      exportarHistorialPdf({ titular: 'Ana', vehiculos: [{ id: 'v1', brand: 'T', model: 'C', plate: 'X' }] }),
    ).rejects.toThrow(/No hay cambios/);
    expect(printToFileAsync).not.toHaveBeenCalled();
  });
});
