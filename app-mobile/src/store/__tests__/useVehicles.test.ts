jest.mock('../../api/controllers/vehicles.controller', () => ({
  vehiclesController: {
    listar: jest.fn(),
    crear: jest.fn(),
    editar: jest.fn(),
    borrar: jest.fn(),
    registrarCambio: jest.fn(),
    editarCambio: jest.fn(),
    borrarCambio: jest.fn(),
  },
}));
jest.mock('../../api/controllers/oil-status.controller', () => ({
  oilStatusController: { reportOdometer: jest.fn(), status: jest.fn() },
}));

import AsyncStorage from 'expo-sqlite/kv-store';
import { ApiError } from '../../api/base';
import { vehiclesController } from '../../api/controllers/vehicles.controller';
import { guardarFlota } from '../../data/local/store';
import { useVehicles } from '../useVehicles';
import type { ApiVehicle } from '../../api/controllers/vehicles.controller';

const api = vehiclesController as unknown as Record<string, jest.Mock>;

const ficha = {
  kind: 'car' as const,
  brand: 'Toyota',
  model: 'Corolla',
  year: 2019,
  plate: 'AB123CD',
  color: '#111111',
  kmPerDay: 30,
};

const remoto = (id: string, plate = 'AB123CD'): ApiVehicle => ({
  id,
  ...ficha,
  plate,
  kmPerDaySource: 'MEASURED',
  lastChangeKm: 45_000,
  nextChangeKm: 50_000,
  gauge: {
    pct: 62,
    status: 'ok',
    limitedBy: 'km',
    kmLeft: 3_100,
    daysLeft: 74,
  },
  odometer: { km: 46_900, source: 'estimated', asOf: '2026-06-04T00:00:00Z' },
});

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.removeItem('ruedalo:flota');
  await AsyncStorage.removeItem('ruedalo:cola');
  useVehicles.setState({
    vehicles: [],
    cola: [],
    rechazos: {},
    hydrated: false,
    activeVehicleId: null,
  });
  api.crear.mockResolvedValue(remoto('x'));
  api.editar.mockResolvedValue(remoto('x'));
  api.borrar.mockResolvedValue(undefined);
});

describe('hidratación', () => {
  it('pinta lo local antes de que responda la red', async () => {
    await guardarFlota([remoto('v1')]);
    await useVehicles.getState().hidratar();

    expect(useVehicles.getState().vehicles).toHaveLength(1);
    expect(useVehicles.getState().hydrated).toBe(true);
    expect(api.listar).not.toHaveBeenCalled();
  });

  it('elige activo el primero si no había ninguno', async () => {
    await guardarFlota([remoto('v1'), remoto('v2', 'XY999ZZ')]);
    await useVehicles.getState().hidratar();
    expect(useVehicles.getState().activeVehicleId).toBe('v1');
  });
});

describe('refresco', () => {
  it('lo de la red reemplaza lo local', async () => {
    api.listar.mockResolvedValue([remoto('v9')]);
    await useVehicles.getState().refresh();
    expect(useVehicles.getState().vehicles[0].id).toBe('v9');
  });

  it('el vehículo activo sobrevive al refresco', async () => {
    useVehicles.setState({ activeVehicleId: 'v2' });
    api.listar.mockResolvedValue([remoto('v1'), remoto('v2', 'XY999ZZ')]);
    await useVehicles.getState().refresh();
    expect(useVehicles.getState().activeVehicleId).toBe('v2');
  });

  it('si el activo ya no existe, el puntero se mueve al primero', async () => {
    useVehicles.setState({ activeVehicleId: 'borrado-en-otro-dispositivo' });
    api.listar.mockResolvedValue([remoto('v1')]);
    await useVehicles.getState().refresh();
    expect(useVehicles.getState().activeVehicleId).toBe('v1');
  });
});

describe('escrituras', () => {
  it('addVehicle lo muestra al instante, antes de la red', () => {
    const id = useVehicles.getState().addVehicle(ficha);

    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(useVehicles.getState().vehicles.map((v) => v.id)).toEqual([id]);
  });

  it('si la red falla, el vehículo sigue en la lista y la op en la cola', async () => {
    api.crear.mockRejectedValue(new ApiError(0, 'NETWORK', 'sin red'));

    const id = useVehicles.getState().addVehicle(ficha);
    await useVehicles.getState().sincronizar();

    expect(useVehicles.getState().vehicles.map((v) => v.id)).toEqual([id]);
    expect(useVehicles.getState().cola).toHaveLength(1);
    expect(useVehicles.getState().cola[0].intentos).toBeGreaterThan(0);
  });

  it('un rechazo permanente saca la op y deja el motivo a la vista', async () => {
    api.crear.mockRejectedValue(new ApiError(409, 'PLATE_TAKEN', 'x'));

    const id = useVehicles.getState().addVehicle(ficha);
    await useVehicles.getState().sincronizar();

    expect(useVehicles.getState().cola).toHaveLength(0);
    expect(useVehicles.getState().rechazos[id]).toBe('PLATE_TAKEN');
  });

  it('removeVehicle lo saca de la UI al instante', () => {
    const id = useVehicles.getState().addVehicle(ficha);
    useVehicles.getState().removeVehicle(id);
    expect(useVehicles.getState().vehicles).toHaveLength(0);
  });

  it('borrar el activo mueve el puntero al que quede', () => {
    const a = useVehicles.getState().addVehicle(ficha);
    const b = useVehicles.getState().addVehicle({ ...ficha, plate: 'XY999ZZ' });
    useVehicles.getState().setActiveVehicle(a);

    useVehicles.getState().removeVehicle(a);

    // Sin esto, el inicio se queda pidiendo un vehículo que ya no está.
    expect(useVehicles.getState().activeVehicleId).toBe(b);
  });

  it('crear y borrar sin señal no manda nada a la red', async () => {
    api.crear.mockRejectedValue(new ApiError(0, 'NETWORK', 'sin red'));

    const id = useVehicles.getState().addVehicle(ficha);
    useVehicles.getState().removeVehicle(id);
    await useVehicles.getState().sincronizar();

    expect(api.borrar).not.toHaveBeenCalled();
    expect(useVehicles.getState().cola).toHaveLength(0);
  });
});
