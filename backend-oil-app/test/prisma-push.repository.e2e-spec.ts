import 'dotenv/config';
import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from '../src/config/env.validation';
import { PrismaService } from '../src/infra/prisma/prisma.service';
import { PrismaDeviceTokenRepository } from '../src/infra/prisma/prisma-device-token.repository';
import { PrismaNotificationPrefRepository } from '../src/infra/prisma/prisma-notification-pref.repository';
import { PrismaNotificationLogRepository } from '../src/infra/prisma/prisma-notification-log.repository';
import { DEFAULT_PREFS } from '../src/modules/notifications/domain/push-message';
import { emailE2E, limpiarUsuariosE2E } from './support/e2e-db';

describe('Repositorios de push contra Postgres (e2e)', () => {
  let prisma: PrismaService;
  let tokens: PrismaDeviceTokenRepository;
  let prefs: PrismaNotificationPrefRepository;
  let logs: PrismaNotificationLogRepository;

  const crearUsuario = async () =>
    prisma.user.create({
      data: {
        email: emailE2E('push'),
        cedula: `V${Math.floor(10_000_000 + Math.random() * 89_999_999)}`,
        passwordHash: 'no-importa',
        fullName: 'Luis Guerrero',
        phone: '+58 414 528 9012',
      },
    });

  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
      ],
      providers: [
        PrismaService,
        PrismaDeviceTokenRepository,
        PrismaNotificationPrefRepository,
        PrismaNotificationLogRepository,
      ],
    }).compile();
    prisma = mod.get(PrismaService);
    await prisma.onModuleInit();
    tokens = mod.get(PrismaDeviceTokenRepository);
    prefs = mod.get(PrismaNotificationPrefRepository);
    logs = mod.get(PrismaNotificationLogRepository);
  });

  afterAll(async () => {
    await limpiarUsuariosE2E(prisma);
    await prisma.onModuleDestroy();
  });

  describe('DeviceToken', () => {
    // EL test de este archivo: es la regla de privacidad del esquema.
    it('registrar el mismo token con otro usuario lo reasigna, no lo duplica', async () => {
      const a = await crearUsuario();
      const b = await crearUsuario();
      const t = `ExponentPushToken[reasignar-${Date.now()}]`;

      await tokens.registrar({ userId: a.id, token: t, platform: 'ANDROID' });
      await tokens.registrar({ userId: b.id, token: t, platform: 'ANDROID' });

      expect(await prisma.deviceToken.count({ where: { token: t } })).toBe(1);
      expect(await tokens.activosDe(a.id)).toEqual([]);
      expect((await tokens.activosDe(b.id)).map((x) => x.token)).toEqual([t]);
    });

    it('registrar un token apagado lo revive', async () => {
      const u = await crearUsuario();
      const t = `ExponentPushToken[revivir-${Date.now()}]`;

      await tokens.registrar({ userId: u.id, token: t, platform: 'IOS' });
      await tokens.apagar(t);
      expect(await tokens.activosDe(u.id)).toEqual([]);

      await tokens.registrar({ userId: u.id, token: t, platform: 'IOS' });
      expect((await tokens.activosDe(u.id)).map((x) => x.token)).toEqual([t]);
    });

    it('eliminar un token que no existe no revienta', async () => {
      await expect(
        tokens.eliminar('ExponentPushToken[fantasma]'),
      ).resolves.toBeUndefined();
    });
  });

  describe('NotificationPref', () => {
    it('sin fila devuelve los valores por defecto y no escribe', async () => {
      const u = await crearUsuario();
      expect(await prefs.obtener(u.id)).toEqual(DEFAULT_PREFS);
      expect(
        await prisma.notificationPref.count({ where: { userId: u.id } }),
      ).toBe(0);
    });

    it('guardar parcial no pisa lo que no vino', async () => {
      const u = await crearUsuario();
      await prefs.guardar(u.id, { warnThresholdKm: 300 });
      const r = await prefs.guardar(u.id, { checkinEnabled: false });

      expect(r.warnThresholdKm).toBe(300);
      expect(r.checkinEnabled).toBe(false);
      expect(r.enabled).toBe(true);
    });
  });

  describe('NotificationLog', () => {
    it('firmasDe devuelve lo registrado del usuario', async () => {
      const u = await crearUsuario();
      await logs.registrar({
        userId: u.id,
        vehicleId: null,
        kind: 'checkin',
        sig: 'checkin:x:2026-W38',
        ticketId: 'tk-1',
      });

      expect(await logs.firmasDe(u.id)).toEqual(
        new Set(['checkin:x:2026-W38']),
      );
    });

    it('marcarReceipt saca la entrada de las pendientes', async () => {
      const u = await crearUsuario();
      const tk = `tk-${Date.now()}`;
      await logs.registrar({
        userId: u.id,
        vehicleId: null,
        kind: 'checkin',
        sig: `s-${tk}`,
        ticketId: tk,
      });
      expect(
        (await logs.pendientesDeReceipt(100)).some((e) => e.ticketId === tk),
      ).toBe(true);

      await logs.marcarReceipt(tk, null);
      expect(
        (await logs.pendientesDeReceipt(100)).some((e) => e.ticketId === tk),
      ).toBe(false);
    });
  });
});
