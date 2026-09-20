import { InMemoryBrandRepository } from './testing/in-memory-brand.repository';
import { BrandsService } from './brands.service';

const USUARIO = 'user-1';
const AHORA = new Date('2026-09-20T12:00:00.000Z');

function armar() {
  const repo = new InMemoryBrandRepository();
  return { repo, service: new BrandsService(repo) };
}

describe('BrandsService.create', () => {
  it('crea una marca nueva y la marca como creada', async () => {
    const { service } = armar();
    const r = await service.create(USUARIO, { kind: 'CAR', name: 'Chery' }, AHORA);
    expect(r.created).toBe(true);
    expect(r.brand.name).toBe('Chery');
    expect(r.brand.nameKey).toBe('CHERY');
    expect(r.brand.createdBy).toBe(USUARIO);
  });

  it('devuelve la existente sin crear nada cuando la clave ya está', async () => {
    const { repo, service } = armar();
    repo.sembrar('CAR', 'Toyota', 'TOYOTA');

    const r = await service.create(USUARIO, { kind: 'CAR', name: '  toyotá ' }, AHORA);

    expect(r.created).toBe(false);
    // Devuelve la capitalización del catálogo, no la que escribió el usuario.
    expect(r.brand.name).toBe('Toyota');
    expect(repo.filas).toHaveLength(1);
  });

  it('es idempotente por id: reintentar la cola no duplica', async () => {
    const { repo, service } = armar();
    const primera = await service.create(
      USUARIO, { id: 'id-fijo', kind: 'CAR', name: 'Chery' }, AHORA,
    );
    const reintento = await service.create(
      USUARIO, { id: 'id-fijo', kind: 'CAR', name: 'Chery' }, AHORA,
    );

    expect(primera.created).toBe(true);
    expect(reintento.created).toBe(false);
    expect(reintento.brand.id).toBe('id-fijo');
    expect(repo.filas).toHaveLength(1);
  });

  it('el mismo nombre en CAR y en MOTO son dos marcas distintas', async () => {
    const { repo, service } = armar();
    await service.create(USUARIO, { kind: 'CAR', name: 'Honda' }, AHORA);
    const moto = await service.create(USUARIO, { kind: 'MOTO', name: 'Honda' }, AHORA);

    expect(moto.created).toBe(true);
    expect(repo.filas).toHaveLength(2);
  });

  it('rechaza un nombre inválido', async () => {
    const { service } = armar();
    await expect(
      service.create(USUARIO, { kind: 'CAR', name: 'http://spam.com' }, AHORA),
    ).rejects.toMatchObject({ response: { error: 'BRAND_NAME_INVALID' } });
  });

  it('rechaza un nombre con una grosería', async () => {
    const { repo, service } = armar();
    await expect(
      service.create(USUARIO, { kind: 'CAR', name: 'Toyota Mierda' }, AHORA),
    ).rejects.toMatchObject({ response: { error: 'BRAND_NAME_INVALID' } });
    expect(repo.filas).toHaveLength(0);
  });

  it('deja pasar la quinta del día y rechaza la sexta', async () => {
    const { service } = armar();
    for (const n of ['Chery', 'JAC', 'BYD', 'Dongfeng', 'Foton']) {
      await service.create(USUARIO, { kind: 'CAR', name: n }, AHORA);
    }
    await expect(
      service.create(USUARIO, { kind: 'CAR', name: 'Haval' }, AHORA),
    ).rejects.toMatchObject({ response: { error: 'BRAND_LIMIT_REACHED' } });
  });

  it('una marca de hace 25 horas no cuenta contra el tope', async () => {
    const { repo, service } = armar();
    for (const n of ['Chery', 'JAC', 'BYD', 'Dongfeng', 'Foton']) {
      await service.create(USUARIO, { kind: 'CAR', name: n }, AHORA);
    }
    for (const f of repo.filas) {
      f.createdAt = new Date(AHORA.getTime() - 25 * 3600 * 1000);
    }
    const r = await service.create(USUARIO, { kind: 'CAR', name: 'Haval' }, AHORA);
    expect(r.created).toBe(true);
  });

  it('devolver una marca existente NO consume cupo', async () => {
    const { repo, service } = armar();
    repo.sembrar('CAR', 'Toyota', 'TOYOTA');
    for (let i = 0; i < 5; i++) {
      await service.create(USUARIO, { kind: 'CAR', name: 'Toyota' }, AHORA);
    }
    const r = await service.create(USUARIO, { kind: 'CAR', name: 'Chery' }, AHORA);
    expect(r.created).toBe(true);
  });
});

describe('BrandsService.list', () => {
  it('filtra por kind: una marca de moto no sale entre los carros', async () => {
    const { repo, service } = armar();
    repo.sembrar('CAR', 'Toyota', 'TOYOTA');
    repo.sembrar('MOTO', 'Bera', 'BERA');

    const carros = await service.list('CAR');
    expect(carros.map((b) => b.name)).toEqual(['Toyota']);
  });

  it('las semillas no cuentan contra el tope de nadie', async () => {
    const { repo, service } = armar();
    for (const n of ['Toyota', 'Ford', 'Kia', 'Fiat', 'Jeep']) {
      repo.sembrar('CAR', n, n.toUpperCase());
    }
    const r = await service.create(USUARIO, { kind: 'CAR', name: 'Chery' }, AHORA);
    expect(r.created).toBe(true);
  });
});
