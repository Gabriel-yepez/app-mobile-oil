import { Test } from '@nestjs/testing';
import type { OilStatus } from '../oil/domain/oil-status';
import { DEVICE_TOKEN_REPOSITORY } from './domain/device-token.repository';
import { NOTIFICATION_LOG_REPOSITORY } from './domain/notification-log.repository';
import { NOTIFICATION_PREF_REPOSITORY } from './domain/notification-pref.repository';
import type { PlannerVehicle } from './domain/push-message';
import { PUSH_SENDER } from './domain/push-sender';
import { PushDispatchService } from './push-dispatch.service';
import { FakePushSender } from './testing/fake-push.sender';
import { InMemoryDeviceTokenRepository } from './testing/in-memory-device-token.repository';
import { InMemoryNotificationLogRepository } from './testing/in-memory-notification-log.repository';
import { InMemoryNotificationPrefRepository } from './testing/in-memory-notification-pref.repository';

const AHORA = new Date('2026-09-22T13:00:00.000Z'); // martes: no hay checkin
const USER = 'user-1';

const vencido: OilStatus = {
  computedAt: AHORA,
  gauge: {
    pct: 0,
    status: 'danger',
    limitedBy: 'km',
    kmLeft: -800,
    daysLeft: 20,
  },
  odometer: {
    km: 50_800,
    source: 'estimated',
    asOf: new Date('2026-09-20T00:00:00.000Z'),
  },
};

const veh: PlannerVehicle = {
  id: 'veh-1',
  label: 'Toyota Corolla',
  kmPerDay: 40,
  lastChangeKm: 45_000,
  lastChangeAt: new Date('2026-03-01T00:00:00.000Z'),
  status: vencido,
};

describe('PushDispatchService', () => {
  let service: PushDispatchService;
  let devices: InMemoryDeviceTokenRepository;
  let prefs: InMemoryNotificationPrefRepository;
  let logs: InMemoryNotificationLogRepository;
  let sender: FakePushSender;

  beforeEach(async () => {
    devices = new InMemoryDeviceTokenRepository();
    prefs = new InMemoryNotificationPrefRepository();
    logs = new InMemoryNotificationLogRepository();
    sender = new FakePushSender();

    const mod = await Test.createTestingModule({
      providers: [
        PushDispatchService,
        { provide: DEVICE_TOKEN_REPOSITORY, useValue: devices },
        { provide: NOTIFICATION_PREF_REPOSITORY, useValue: prefs },
        { provide: NOTIFICATION_LOG_REPOSITORY, useValue: logs },
        { provide: PUSH_SENDER, useValue: sender },
      ],
    }).compile();

    service = mod.get(PushDispatchService);
  });

  const conDispositivos = async (...tokens: string[]) => {
    for (const t of tokens) {
      await devices.registrar({ userId: USER, token: t, platform: 'ANDROID' });
    }
  };

  it('manda el aviso a cada dispositivo activo del usuario', async () => {
    await conDispositivos('ExponentPushToken[a]', 'ExponentPushToken[b]');

    const r = await service.despacharUsuario(USER, [veh], AHORA);

    expect(sender.enviados.map((e) => e.token)).toEqual([
      'ExponentPushToken[a]',
      'ExponentPushToken[b]',
    ]);
    expect(r.enviados).toBe(2);
    expect(r.planificados).toBe(1);
  });

  // Si anotara la firma sin haber mandado nada, el usuario que registra su
  // teléfono mañana no recibiría el aviso de un vehículo que YA está vencido.
  it('sin dispositivos no anota la firma: el aviso sigue pendiente', async () => {
    const r = await service.despacharUsuario(USER, [veh], AHORA);

    expect(sender.enviados).toEqual([]);
    expect(await logs.firmasDe(USER)).toEqual(new Set());
    expect(r.enviados).toBe(0);
  });

  it('el segundo despacho del mismo hecho no manda nada', async () => {
    await conDispositivos('ExponentPushToken[a]');

    await service.despacharUsuario(USER, [veh], AHORA);
    const segundo = await service.despacharUsuario(USER, [veh], AHORA);

    expect(sender.enviados).toHaveLength(1);
    expect(segundo.planificados).toBe(0);
  });

  it('DeviceNotRegistered apaga el token', async () => {
    await conDispositivos('ExponentPushToken[muerto]');
    sender.ticketsPorDevolver = [
      { ok: false, code: 'DeviceNotRegistered', message: 'desinstalada' },
    ];

    const r = await service.despacharUsuario(USER, [veh], AHORA);

    expect(await devices.activosDe(USER)).toEqual([]);
    expect(r.tokensApagados).toBe(1);
  });

  // El fallo de red no debe "gastar" el aviso: si anotara la firma, el usuario
  // nunca se enteraría de que su aceite está vencido.
  it('un envío fallido no anota la firma y mañana se reintenta', async () => {
    await conDispositivos('ExponentPushToken[a]');
    sender.ticketsPorDevolver = [
      { ok: false, code: 'SEND_FAILED', message: 'sin red' },
    ];

    const primero = await service.despacharUsuario(USER, [veh], AHORA);
    expect(primero.fallidos).toBe(1);
    expect(await logs.firmasDe(USER)).toEqual(new Set());

    const segundo = await service.despacharUsuario(USER, [veh], AHORA);
    expect(segundo.planificados).toBe(1);
  });

  it('si un dispositivo recibe y otro falla, la firma queda anotada', async () => {
    await conDispositivos('ExponentPushToken[a]', 'ExponentPushToken[b]');
    sender.ticketsPorDevolver = [
      { ok: true, id: 'tk-ok' },
      { ok: false, code: 'SEND_FAILED', message: 'sin red' },
    ];

    await service.despacharUsuario(USER, [veh], AHORA);
    const segundo = await service.despacharUsuario(USER, [veh], AHORA);

    expect(segundo.planificados).toBe(0);
  });

  it('con las preferencias apagadas no llama al emisor', async () => {
    await conDispositivos('ExponentPushToken[a]');
    await prefs.guardar(USER, { enabled: false });

    await service.despacharUsuario(USER, [veh], AHORA);

    expect(sender.enviados).toEqual([]);
  });
});
