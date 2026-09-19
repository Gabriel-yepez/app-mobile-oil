// Test de integración: el único que toca la base. Es el que puede demostrar
// que el mapeo a dominio y los índices únicos funcionan de verdad; los tests
// unitarios corren contra el doble en memoria y nunca verían esto.
import 'dotenv/config';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../src/infra/prisma/prisma.service';
import { PrismaUserRepository } from '../src/infra/prisma/prisma-user.repository';
import type { NewUser } from '../src/modules/users/domain/user';

const nuevo = (over: Partial<NewUser> = {}): NewUser => ({
  email: `luis-${Date.now()}-${Math.random().toString(36).slice(2)}@correo.com`,
  cedula: `V${Math.floor(10_000_000 + Math.random() * 89_999_999)}`,
  passwordHash: 'hash',
  fullName: 'Luis Guerrero',
  phone: '+58 414 528 9012',
  state: null,
  city: null,
  currency: 'BOTH',
  ...over,
});

describe('PrismaUserRepository (integración)', () => {
  const prisma = new PrismaService(new ConfigService());
  const repo = new PrismaUserRepository(prisma);

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('crea y recupera devolviendo el tipo de dominio', async () => {
    const data = nuevo();
    const creado = await repo.create(data);

    expect(creado.id).toBeTruthy();
    expect(creado.currency).toBe('BOTH');
    expect(creado.createdAt).toBeInstanceOf(Date);
    await expect(repo.findByEmail(data.email)).resolves.toMatchObject({ id: creado.id });
    await expect(repo.findById(creado.id)).resolves.toMatchObject({ email: data.email });
  });

  it('devuelve null cuando no existe', async () => {
    await expect(repo.findByEmail('no-existe@correo.com')).resolves.toBeNull();
    await expect(
      repo.findById('00000000-0000-0000-0000-000000000000'),
    ).resolves.toBeNull();
  });

  it('detecta correo y cédula ya usados', async () => {
    const data = nuevo();
    await repo.create(data);

    await expect(repo.existsByEmail(data.email)).resolves.toBe(true);
    await expect(repo.existsByCedula(data.cedula)).resolves.toBe(true);
    await expect(repo.existsByCedula('V00000001')).resolves.toBe(false);
  });

  // El índice único es la última línea de defensa contra dos cuentas de la
  // misma persona: si una carrera esquiva el existsBy*, la base debe rechazar.
  it('la base rechaza un correo duplicado aunque el servicio no lo atrape', async () => {
    const data = nuevo();
    await repo.create(data);

    await expect(repo.create(nuevo({ email: data.email }))).rejects.toThrow();
  });

  it('la base rechaza una cédula duplicada', async () => {
    const data = nuevo();
    await repo.create(data);

    await expect(repo.create(nuevo({ cedula: data.cedula }))).rejects.toThrow();
  });
});
