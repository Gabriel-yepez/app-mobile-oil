import { InMemoryUserRepository } from './in-memory-user.repository';
import type { NewUser } from '../domain/user';

const nuevo = (over: Partial<NewUser> = {}): NewUser => ({
  email: 'luis@correo.com',
  cedula: 'V25481073',
  passwordHash: 'hash',
  fullName: 'Luis Guerrero',
  phone: '+58 414 528 9012',
  state: null,
  city: null,
  currency: 'BOTH',
  ...over,
});

describe('InMemoryUserRepository', () => {
  let repo: InMemoryUserRepository;

  beforeEach(() => {
    repo = new InMemoryUserRepository();
  });

  it('crea y recupera por id y por correo', async () => {
    const creado = await repo.create(nuevo());

    expect(creado.id).toBeTruthy();
    await expect(repo.findById(creado.id)).resolves.toMatchObject({
      email: 'luis@correo.com',
    });
    await expect(repo.findByEmail('luis@correo.com')).resolves.toMatchObject({
      id: creado.id,
    });
  });

  it('devuelve null cuando no existe', async () => {
    await expect(repo.findByEmail('nadie@correo.com')).resolves.toBeNull();
    await expect(repo.findById('no-existe')).resolves.toBeNull();
  });

  it('informa de correo y cédula ya usados', async () => {
    await repo.create(nuevo());

    await expect(repo.existsByEmail('luis@correo.com')).resolves.toBe(true);
    await expect(repo.existsByCedula('V25481073')).resolves.toBe(true);
    await expect(repo.existsByCedula('V99999999')).resolves.toBe(false);
  });
});
