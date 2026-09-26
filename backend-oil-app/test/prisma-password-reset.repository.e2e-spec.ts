// Integración contra Postgres. Lo que importa acá es lo que el doble en memoria
// no puede demostrar: que las operaciones delicadas son atómicas de verdad
// cuando llegan peticiones simultáneas.
import 'dotenv/config';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../src/infra/prisma/prisma.service';
import { PrismaPasswordResetRepository } from '../src/infra/prisma/prisma-password-reset.repository';
import { PrismaUserRepository } from '../src/infra/prisma/prisma-user.repository';
import { emailE2E, limpiarUsuariosE2E } from './support/e2e-db';

const EN_15_MIN = () => new Date(Date.now() + 15 * 60_000);

describe('PrismaPasswordResetRepository (integración)', () => {
  const prisma = new PrismaService(new ConfigService());
  const users = new PrismaUserRepository(prisma);
  const repo = new PrismaPasswordResetRepository(prisma);

  const usuario = () =>
    users.create({
      email: emailE2E('reset'),
      cedula: `V${Math.floor(10_000_000 + Math.random() * 89_999_999)}`,
      passwordHash: 'hash',
      fullName: 'Luis Guerrero',
      phone: '+58 414 528 9012',
      state: 'Zulia',
      city: 'Maracaibo',
      currency: 'BOTH',
    });

  afterAll(async () => {
    await limpiarUsuariosE2E(prisma);
    await prisma.$disconnect();
  });

  it('crea un código y lo encuentra como vigente', async () => {
    const u = await usuario();
    const creado = await repo.reemplazarCodigo({
      userId: u.id,
      codeHash: 'h1',
      expiresAt: EN_15_MIN(),
    });

    await expect(repo.vigenteDe(u.id)).resolves.toMatchObject({
      id: creado.id,
      attempts: 0,
      usedAt: null,
    });
  });

  // Pedir un código nuevo tiene que matar el anterior: si no, quien tenga
  // acceso a un correo viejo del usuario seguiría pudiendo usarlo.
  it('un código nuevo invalida el anterior', async () => {
    const u = await usuario();
    const viejo = await repo.reemplazarCodigo({
      userId: u.id,
      codeHash: 'viejo',
      expiresAt: EN_15_MIN(),
    });
    const nuevo = await repo.reemplazarCodigo({
      userId: u.id,
      codeHash: 'nuevo',
      expiresAt: EN_15_MIN(),
    });

    const vigente = await repo.vigenteDe(u.id);
    expect(vigente?.id).toBe(nuevo.id);
    expect(vigente?.id).not.toBe(viejo.id);
  });

  it('cuenta intentos en paralelo sin perder ninguno', async () => {
    const u = await usuario();
    const r = await repo.reemplazarCodigo({
      userId: u.id,
      codeHash: 'h',
      expiresAt: EN_15_MIN(),
    });

    // Leer-sumar-escribir perdería incrementos, y el tope de intentos se
    // esquivaría disparando en paralelo.
    await Promise.all(Array.from({ length: 5 }, () => repo.sumarIntento(r.id)));

    await expect(repo.vigenteDe(u.id)).resolves.toMatchObject({ attempts: 5 });
  });

  it('encuentra el intento por el hash de su token', async () => {
    const u = await usuario();
    const r = await repo.reemplazarCodigo({
      userId: u.id,
      codeHash: 'h',
      expiresAt: EN_15_MIN(),
    });
    const tokenHash = `tok-${Date.now()}-${Math.random()}`;

    await repo.marcarVerificado(r.id, {
      resetTokenHash: tokenHash,
      resetExpiresAt: EN_15_MIN(),
    });

    await expect(repo.porResetToken(tokenHash)).resolves.toMatchObject({
      id: r.id,
    });
  });

  // EL test de este archivo. Dos peticiones simultáneas con el mismo token:
  // si consumir fuera leer-y-luego-escribir, las dos pasarían la comprobación
  // y la contraseña se cambiaría dos veces con un token de un solo uso.
  it('consumir es atómico: de diez intentos simultáneos, gana uno', async () => {
    const u = await usuario();
    const r = await repo.reemplazarCodigo({
      userId: u.id,
      codeHash: 'h',
      expiresAt: EN_15_MIN(),
    });

    const resultados = await Promise.all(
      Array.from({ length: 10 }, () => repo.consumir(r.id)),
    );

    expect(resultados.filter(Boolean)).toHaveLength(1);
  });

  it('borrar al usuario se lleva sus códigos', async () => {
    const u = await usuario();
    await repo.reemplazarCodigo({
      userId: u.id,
      codeHash: 'h',
      expiresAt: EN_15_MIN(),
    });

    await prisma.user.delete({ where: { id: u.id } });

    await expect(
      prisma.passwordResetCode.count({ where: { userId: u.id } }),
    ).resolves.toBe(0);
  });
});
