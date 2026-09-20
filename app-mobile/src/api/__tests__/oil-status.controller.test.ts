// Mismo molde que base.test.ts: se mockea la instancia de axios, no `fetch`.
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
import { oilStatusController } from '../controllers/oil-status.controller';
import { tokenStorage } from '../tokens';

const storage = tokenStorage as jest.Mocked<typeof tokenStorage>;
const mockRequest = (
  jest.requireMock('axios') as {
    default: { create: () => { request: jest.Mock } };
  }
).default.create().request;

const ultimaPeticion = () =>
  mockRequest.mock.calls.at(-1)![0] as AxiosRequestConfig;

describe('oilStatusController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    ApiClient.__reset();
    storage.get.mockResolvedValue({ accessToken: 'tok', refreshToken: 'ref' });
    mockRequest.mockResolvedValue({ status: 200, data: {} });
  });

  it('pide el estado a /vehicles/<id>/oil-status con Bearer', async () => {
    await oilStatusController.status('v1');

    const req = ultimaPeticion();
    expect(req.method).toBe('GET');
    expect(req.url).toBe('/vehicles/v1/oil-status');
    expect(req.headers?.Authorization).toBe('Bearer tok');
  });

  it('reporta el odómetro con POST y el km en el cuerpo', async () => {
    await oilStatusController.reportOdometer('v1', 47250);

    const req = ultimaPeticion();
    expect(req.method).toBe('POST');
    expect(req.url).toBe('/vehicles/v1/odometer');
    expect(req.data).toEqual({ km: 47250 });
    expect(req.headers?.Authorization).toBe('Bearer tok');
  });
});
