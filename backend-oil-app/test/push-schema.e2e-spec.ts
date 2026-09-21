import 'dotenv/config';
import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from '../src/infra/prisma/prisma.service';
import { validateEnv } from '../src/config/env.validation';

describe('Esquema de notificaciones push (e2e)', () => {
  let prisma: PrismaService;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
      ],
      providers: [PrismaService],
    }).compile();
    prisma = mod.get(PrismaService);
    await prisma.onModuleInit();
  });

  afterAll(async () => {
    await prisma.onModuleDestroy();
  });

  // En Prisma 7 `migrate dev` NO regenera el cliente, así que el modo de fallo
  // real es tener las tablas en la base y `prisma.deviceToken` en undefined.
  // Esto lo agarra antes que el build.
  it('el cliente generado expone los tres modelos nuevos', () => {
    expect(prisma.deviceToken).toBeDefined();
    expect(prisma.notificationPref).toBeDefined();
    expect(prisma.notificationLog).toBeDefined();
  });

  it('las tablas existen y se pueden consultar', async () => {
    await expect(prisma.deviceToken.count()).resolves.toBeGreaterThanOrEqual(0);
    await expect(
      prisma.notificationPref.count(),
    ).resolves.toBeGreaterThanOrEqual(0);
    await expect(
      prisma.notificationLog.count(),
    ).resolves.toBeGreaterThanOrEqual(0);
  });
});
