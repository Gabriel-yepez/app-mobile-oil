import { InMemoryShopRepository } from './testing/in-memory-shop.repository';
import { ShopsService } from './shops.service';

const USUARIO = 'user-1';
const AHORA = new Date('2026-09-28T12:00:00.000Z');

function armar() {
  const repo = new InMemoryShopRepository();
  return { repo, service: new ShopsService(repo) };
}

describe('ShopsService.create', () => {
  it('crea un taller nuevo y lo marca como creado', async () => {
    const { service } = armar();
    const r = await service.create(
      USUARIO,
      { name: '  Lubricentro   El Rápido ' },
      AHORA,
    );
    expect(r.created).toBe(true);
    expect(r.shop.name).toBe('Lubricentro El Rápido');
    expect(r.shop.nameKey).toBe('LUBRICENTROELRAPIDO');
    expect(r.shop.createdBy).toBe(USUARIO);
  });

  it('devuelve el existente sin crear nada cuando la clave ya está', async () => {
    const { repo, service } = armar();
    repo.sembrar('Lubricantes El Marqués', 'LUBRICANTESELMARQUES');

    const r = await service.create(
      USUARIO,
      { name: 'lubricantes el marques' },
      AHORA,
    );

    expect(r.created).toBe(false);
    expect(r.shop.name).toBe('Lubricantes El Marqués');
    expect(repo.filas).toHaveLength(1);
  });

  it('es idempotente por id: reintentar la cola no duplica', async () => {
    const { repo, service } = armar();
    await service.create(
      USUARIO,
      { id: 'id-fijo', name: 'Taller Pérez' },
      AHORA,
    );
    const reintento = await service.create(
      USUARIO,
      { id: 'id-fijo', name: 'Taller Pérez' },
      AHORA,
    );

    expect(reintento.created).toBe(false);
    expect(repo.filas).toHaveLength(1);
  });

  it('rechaza un nombre inválido', async () => {
    const { service } = armar();
    await expect(
      service.create(USUARIO, { name: 'http://spam.com' }, AHORA),
    ).rejects.toMatchObject({ response: { error: 'SHOP_NAME_INVALID' } });
  });

  it('rechaza groserías con el mismo error que el charset', async () => {
    const { service } = armar();
    await expect(
      service.create(USUARIO, { name: 'Taller Mierda' }, AHORA),
    ).rejects.toMatchObject({ response: { error: 'SHOP_NAME_INVALID' } });
  });

  it('corta en el sexto taller del día', async () => {
    const { service } = armar();
    for (let i = 1; i <= 5; i++) {
      await service.create(USUARIO, { name: `Taller ${i}` }, AHORA);
    }
    await expect(
      service.create(USUARIO, { name: 'Taller 6' }, AHORA),
    ).rejects.toMatchObject({ response: { error: 'SHOP_LIMIT_REACHED' } });
  });

  it('las semillas no cuentan contra el cupo de nadie', async () => {
    const { repo, service } = armar();
    for (let i = 1; i <= 6; i++) repo.sembrar(`Semilla ${i}`, `SEMILLA${i}`);

    const r = await service.create(USUARIO, { name: 'Taller Nuevo' }, AHORA);
    expect(r.created).toBe(true);
  });
});
