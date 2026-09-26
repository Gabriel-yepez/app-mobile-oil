import { DolarApiTasaSource } from './dolarapi-tasa.source';

const URL = 'https://ve.dolarapi.com/v1/dolares/oficial';

const respuesta = (status: number, body: unknown) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  }) as Response;

// La forma real que devuelve ve.dolarapi.com (consultada el 26 sep 2026).
const OFICIAL = {
  moneda: 'USD',
  fuente: 'oficial',
  nombre: 'Dólar',
  compra: null,
  venta: null,
  promedio: 855.6625,
  fechaActualizacion: '2026-09-25T00:00:00-04:00',
};

describe('DolarApiTasaSource', () => {
  it('pide la URL configurada y traduce la respuesta al dominio', async () => {
    const fetchFn = jest.fn().mockResolvedValue(respuesta(200, OFICIAL));
    const r = await new DolarApiTasaSource(URL, fetchFn).tasaBcv();

    expect(fetchFn).toHaveBeenCalledWith(URL, expect.anything());
    expect(r.bsPorUsd).toBe(855.6625);
    expect(r.vigente.toISOString()).toBe('2026-09-25T04:00:00.000Z');
  });

  it('un status que no es 2xx es un error', async () => {
    const fetchFn = jest.fn().mockResolvedValue(respuesta(502, {}));
    await expect(
      new DolarApiTasaSource(URL, fetchFn).tasaBcv(),
    ).rejects.toThrow('502');
  });

  it.each([
    ['sin promedio', { ...OFICIAL, promedio: null }],
    ['promedio en cero', { ...OFICIAL, promedio: 0 }],
    ['promedio como texto', { ...OFICIAL, promedio: '855,66' }],
    ['fecha que no parsea', { ...OFICIAL, fechaActualizacion: 'ayer' }],
  ])(
    'rechaza una respuesta %s en vez de propagar basura',
    async (_caso, body) => {
      const fetchFn = jest.fn().mockResolvedValue(respuesta(200, body));
      await expect(
        new DolarApiTasaSource(URL, fetchFn).tasaBcv(),
      ).rejects.toThrow();
    },
  );
});
