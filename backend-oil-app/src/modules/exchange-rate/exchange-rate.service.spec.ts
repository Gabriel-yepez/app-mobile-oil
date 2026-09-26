import type { TasaBcv, TasaSource } from './domain/tasa-source';
import { ExchangeRateService, TTL_MS } from './exchange-rate.service';

const T0 = new Date('2026-09-26T12:00:00.000Z');
const despues = (ms: number) => new Date(T0.getTime() + ms);

const tasa = (bsPorUsd: number): TasaBcv => ({
  bsPorUsd,
  vigente: new Date('2026-09-25T04:00:00.000Z'),
});

class FakeSource implements TasaSource {
  llamadas = 0;
  respuestas: Array<TasaBcv | Error> = [];

  tasaBcv(): Promise<TasaBcv> {
    this.llamadas++;
    const r = this.respuestas.shift();
    if (!r) throw new Error('FakeSource sin respuestas preparadas');
    return r instanceof Error ? Promise.reject(r) : Promise.resolve(r);
  }
}

function armar(...respuestas: Array<TasaBcv | Error>) {
  const source = new FakeSource();
  source.respuestas = respuestas;
  return { source, service: new ExchangeRateService(source) };
}

describe('ExchangeRateService.bcv', () => {
  it('devuelve la tasa del proveedor con la hora en que se consultó', async () => {
    const { service } = armar(tasa(855.66));
    const r = await service.bcv(T0);
    expect(r.bsPorUsd).toBe(855.66);
    expect(r.consultada).toEqual(T0);
  });

  it('dentro del TTL no vuelve a consultar al proveedor', async () => {
    const { source, service } = armar(tasa(855.66));
    await service.bcv(T0);
    await service.bcv(despues(TTL_MS - 1));
    expect(source.llamadas).toBe(1);
  });

  it('vencido el TTL consulta de nuevo', async () => {
    const { source, service } = armar(tasa(855.66), tasa(860.1));
    await service.bcv(T0);
    const r = await service.bcv(despues(TTL_MS));
    expect(source.llamadas).toBe(2);
    expect(r.bsPorUsd).toBe(860.1);
  });

  it('si el proveedor falla, devuelve la última tasa conocida', async () => {
    const { service } = armar(tasa(855.66), new Error('sin red'));
    await service.bcv(T0);
    const r = await service.bcv(despues(TTL_MS));
    expect(r.bsPorUsd).toBe(855.66);
    // La hora de consulta no se adelanta: la app puede ver que es vieja.
    expect(r.consultada).toEqual(T0);
  });

  it('tras un fallo no reintenta en cada petición: espera un rato', async () => {
    const { source, service } = armar(tasa(855.66), new Error('sin red'));
    await service.bcv(T0);
    await service.bcv(despues(TTL_MS));
    await service.bcv(despues(TTL_MS + 1000));
    expect(source.llamadas).toBe(2);
  });

  it('sin ninguna tasa previa, un fallo es 503 EXCHANGE_RATE_UNAVAILABLE', async () => {
    const { service } = armar(new Error('sin red'));
    await expect(service.bcv(T0)).rejects.toMatchObject({
      status: 503,
      response: { error: 'EXCHANGE_RATE_UNAVAILABLE' },
    });
  });

  it('peticiones simultáneas comparten una sola consulta al proveedor', async () => {
    const { source, service } = armar(tasa(855.66));
    const [a, b] = await Promise.all([service.bcv(T0), service.bcv(T0)]);
    expect(source.llamadas).toBe(1);
    expect(a).toEqual(b);
  });
});
