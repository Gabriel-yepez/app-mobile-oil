// Mismo molde que oil-status.controller.test: se mockea la instancia de axios.
const esErrorDeAxios = (e: unknown) =>
  Boolean((e as { isAxiosError?: boolean })?.isAxiosError);

jest.mock('axios', () => {
  const request = jest.fn();
  const instancia = { request };
  return {
    __esModule: true,
    default: { create: () => instancia, isAxiosError: esErrorDeAxios },
    isAxiosError: esErrorDeAxios,
  };
});

jest.mock('../tokens', () => ({
  tokenStorage: { get: jest.fn(), save: jest.fn(), clear: jest.fn() },
}));

import type { AxiosRequestConfig } from 'axios';
import { ApiClient } from '../base';
import { notificationsController } from '../controllers/notifications.controller';
import { tokenStorage } from '../tokens';

const storage = tokenStorage as jest.Mocked<typeof tokenStorage>;
const mockRequest = (
  jest.requireMock('axios') as {
    default: { create: () => { request: jest.Mock } };
  }
).default.create().request;

const ultimaPeticion = () =>
  mockRequest.mock.calls.at(-1)![0] as AxiosRequestConfig;

const PREFS = {
  enabled: true,
  warnEnabled: true,
  overdueEnabled: true,
  checkinEnabled: true,
  warnThresholdKm: 500,
  checkinWeekday: 1,
};

describe('notificationsController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    ApiClient.__reset();
    storage.get.mockResolvedValue({ accessToken: 'tok', refreshToken: 'ref' });
    mockRequest.mockResolvedValue({ status: 200, data: PREFS });
  });

  it('registra el dispositivo con POST /me/devices', async () => {
    await notificationsController.registrarDispositivo(
      'ExponentPushToken[a]',
      'ANDROID'
    );

    const req = ultimaPeticion();
    expect(req.method).toBe('POST');
    expect(req.url).toBe('/me/devices');
    expect(req.data).toEqual({
      token: 'ExponentPushToken[a]',
      platform: 'ANDROID',
    });
    expect(req.headers?.Authorization).toBe('Bearer tok');
  });

  // El token va en la ruta y trae corchetes: sin codificar, la petición sale
  // malformada y el servidor nunca da de baja nada.
  it('codifica el token al dar de baja', async () => {
    await notificationsController.darDeBaja('ExponentPushToken[a b]');

    const req = ultimaPeticion();
    expect(req.method).toBe('DELETE');
    expect(req.url).toBe('/me/devices/ExponentPushToken%5Ba%20b%5D');
  });

  it('pide las preferencias con GET', async () => {
    const r = await notificationsController.obtenerPrefs();

    const req = ultimaPeticion();
    expect(req.method).toBe('GET');
    expect(req.url).toBe('/me/notification-prefs');
    expect(r).toEqual(PREFS);
  });

  it('guarda solo lo que cambió', async () => {
    await notificationsController.guardarPrefs({ enabled: false });

    const req = ultimaPeticion();
    expect(req.method).toBe('PATCH');
    expect(req.url).toBe('/me/notification-prefs');
    expect(req.data).toEqual({ enabled: false });
  });
});
