jest.mock('../../api/controllers/exchange-rate.controller', () => ({
  exchangeRateController: { bcv: jest.fn() },
}));

import { exchangeRateController } from '../../api/controllers/exchange-rate.controller';
import { useTasaBcv } from '../tasaBcv';

const api = exchangeRateController as jest.Mocked<typeof exchangeRateController>;

const TASA = {
  bsPerUsd: 855.6625,
  effectiveDate: '2026-09-25T04:00:00.000Z',
  fetchedAt: '2026-09-26T12:00:00.000Z',
};

describe('useTasaBcv', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useTasaBcv.setState({ tasa: null });
  });

  it('arranca sin tasa: nunca con un número inventado', () => {
    expect(useTasaBcv.getState().tasa).toBeNull();
  });

  it('guarda la tasa que devuelve el backend', async () => {
    api.bcv.mockResolvedValue(TASA);
    await useTasaBcv.getState().cargar();
    expect(useTasaBcv.getState().tasa).toEqual(TASA);
  });

  // Una conversión de ayer sirve; que el "≈ Bs.S" desaparezca sin señal, no.
  it('si la carga falla, se queda con la última conocida', async () => {
    useTasaBcv.setState({ tasa: TASA });
    api.bcv.mockRejectedValue(new Error('sin red'));

    await useTasaBcv.getState().cargar();

    expect(useTasaBcv.getState().tasa).toEqual(TASA);
  });
});
