import { Test } from '@nestjs/testing';
import { DEVICE_TOKEN_REPOSITORY } from './domain/device-token.repository';
import { NOTIFICATION_LOG_REPOSITORY } from './domain/notification-log.repository';
import { PUSH_SENDER } from './domain/push-sender';
import { ReceiptsService } from './receipts.service';
import { FakePushSender } from './testing/fake-push.sender';
import { InMemoryDeviceTokenRepository } from './testing/in-memory-device-token.repository';
import { InMemoryNotificationLogRepository } from './testing/in-memory-notification-log.repository';

describe('ReceiptsService', () => {
  let service: ReceiptsService;
  let logs: InMemoryNotificationLogRepository;
  let devices: InMemoryDeviceTokenRepository;
  let sender: FakePushSender;

  const TOKEN = 'ExponentPushToken[muerto]';

  beforeEach(async () => {
    logs = new InMemoryNotificationLogRepository();
    devices = new InMemoryDeviceTokenRepository();
    sender = new FakePushSender();

    const mod = await Test.createTestingModule({
      providers: [
        ReceiptsService,
        { provide: NOTIFICATION_LOG_REPOSITORY, useValue: logs },
        { provide: DEVICE_TOKEN_REPOSITORY, useValue: devices },
        { provide: PUSH_SENDER, useValue: sender },
      ],
    }).compile();

    service = mod.get(ReceiptsService);
  });

  const pendiente = (ticketId: string) =>
    logs.registrar({
      userId: 'u1',
      vehicleId: null,
      kind: 'checkin',
      sig: `s-${ticketId}`,
      ticketId,
      token: TOKEN,
    });

  it('sin pendientes no llama al emisor', async () => {
    const r = await service.procesarPendientes();

    expect(r).toEqual({ revisados: 0, tokensApagados: 0 });
    expect(sender.receiptsPedidos).toEqual([]);
  });

  it('marca como revisadas las entregas correctas', async () => {
    await pendiente('tk-1');

    const r = await service.procesarPendientes();

    expect(r.revisados).toBe(1);
    expect(await logs.pendientesDeReceipt(10)).toEqual([]);
  });

  // Es el caso que justifica todo el ciclo de receipts: el ticket salió bien y
  // el fallo aparece 15 minutos después, cuando Expo confirma la entrega real.
  it('un DeviceNotRegistered diferido apaga el token', async () => {
    await devices.registrar({ userId: 'u1', token: TOKEN, platform: 'IOS' });
    await pendiente('tk-1');
    sender.receiptsPorDevolver = [
      { ticketId: 'tk-1', error: 'DeviceNotRegistered' },
    ];

    const r = await service.procesarPendientes();

    expect(r.tokensApagados).toBe(1);
    expect(await devices.activosDe('u1')).toEqual([]);
  });

  // Un error que no es DeviceNotRegistered se anota pero NO apaga nada: un
  // MessageRateExceeded no significa que el teléfono haya desaparecido.
  it('otro error se marca sin apagar el token', async () => {
    await devices.registrar({ userId: 'u1', token: TOKEN, platform: 'IOS' });
    await pendiente('tk-1');
    sender.receiptsPorDevolver = [
      { ticketId: 'tk-1', error: 'MessageRateExceeded' },
    ];

    const r = await service.procesarPendientes();

    expect(r.tokensApagados).toBe(0);
    expect(await devices.activosDe('u1')).toHaveLength(1);
    expect(await logs.pendientesDeReceipt(10)).toEqual([]);
  });
});
