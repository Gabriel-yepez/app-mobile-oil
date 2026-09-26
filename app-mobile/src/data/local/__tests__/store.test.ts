import AsyncStorage from 'expo-sqlite/kv-store';
import {
  guardarCola,
  guardarEstado,
  guardarFlota,
  leerCola,
  leerEstado,
  leerFlota,
} from '../store';
import type { ApiVehicle } from '../../../api/controllers/vehicles.controller';

const vehiculo = (id: string): ApiVehicle => ({
  id,
  kind: 'car',
  brand: 'Toyota',
  model: 'Corolla',
  year: 2019,
  plate: 'AB123CD',
  color: '#111111',
  kmPerDay: 30,
  kmPerDaySource: 'DECLARED',
  lastChangeKm: 45_000,
  lastChangeAt: '2026-06-04T00:00:00.000Z',
  nextChangeKm: 50_000,
  alertSnoozedUntil: null,
  gauge: null,
  odometer: null,
});

beforeEach(async () => {
  await AsyncStorage.removeItem('ruedalo:flota');
  await AsyncStorage.removeItem('ruedalo:cola');
  await AsyncStorage.removeItem('ruedalo:estado:v1');
});

describe('flota', () => {
  it('lo guardado vuelve igual', async () => {
    await guardarFlota([vehiculo('v1')]);
    expect(await leerFlota()).toEqual([vehiculo('v1')]);
  });

  it('sin nada guardado devuelve lista vacía, no explota', async () => {
    expect(await leerFlota()).toEqual([]);
  });

  it('un JSON corrupto devuelve el vacío en vez de tirar la app', async () => {
    // Mismo criterio que reconcile con el layout: el almacenamiento puede
    // venir roto y eso no puede ser una pantalla en blanco.
    await AsyncStorage.setItem('ruedalo:flota', '{no es json');
    expect(await leerFlota()).toEqual([]);
  });

  it('algo que no es una lista devuelve el vacío', async () => {
    await AsyncStorage.setItem('ruedalo:flota', '{"vehiculos":3}');
    expect(await leerFlota()).toEqual([]);
  });
});

describe('cola', () => {
  it('lo guardado vuelve igual', async () => {
    const cola = [
      {
        op: { op: 'DELETE_VEHICLE' as const, id: 'v1' },
        intentos: 2,
        encoladaEn: '2026-06-04T00:00:00.000Z',
      },
    ];
    await guardarCola(cola);
    expect(await leerCola()).toEqual(cola);
  });

  it('sin nada guardado devuelve cola vacía', async () => {
    expect(await leerCola()).toEqual([]);
  });
});

describe('bloque de estado', () => {
  const bloque = {
    vehicleId: 'v1',
    computedAt: '2026-07-04T00:00:00.000Z',
    gauge: {
      pct: 62,
      status: 'ok' as const,
      limitedBy: 'km' as const,
      kmLeft: 3_100,
      daysLeft: 74,
    },
    odometer: {
      km: 46_900,
      source: 'estimated' as const,
      asOf: '2026-06-04T00:00:00.000Z',
    },
    cycle: null,
    oil: null,
  };

  it('lo guardado vuelve igual, por vehículo', async () => {
    await guardarEstado('v1', bloque);
    expect(await leerEstado('v1')).toEqual(bloque);
  });

  it('un vehículo sin estado guardado devuelve null', async () => {
    expect(await leerEstado('v-desconocido')).toBeNull();
  });
});
