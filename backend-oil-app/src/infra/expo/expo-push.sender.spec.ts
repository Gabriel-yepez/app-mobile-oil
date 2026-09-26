import type { Expo } from 'expo-server-sdk';
import type { PushMessage } from '../../modules/notifications/domain/push-message';
import { ExpoPushSender } from './expo-push.sender';

const mensaje = (id: string): PushMessage => ({
  kind: 'warn',
  userId: 'u1',
  vehicleId: id,
  title: 'Cambio de aceite cerca',
  body: 'body',
  sig: `warn:${id}`,
  data: { screen: 'VehicleDetail', vehicleId: id },
});

/** Doble del cliente de Expo: el adaptador solo usa estos cuatro métodos. */
const clienteFalso = (over: Partial<Record<string, unknown>>): Expo =>
  ({
    chunkPushNotifications: (m: unknown[]) => [m],
    sendPushNotificationsAsync: () => Promise.resolve([]),
    chunkPushNotificationReceiptIds: (ids: string[]) => [ids],
    getPushNotificationReceiptsAsync: () => Promise.resolve({}),
    ...over,
  }) as unknown as Expo;

describe('ExpoPushSender', () => {
  it('traduce un ticket ok del SDK al ticket del dominio', async () => {
    const sender = new ExpoPushSender(
      clienteFalso({
        sendPushNotificationsAsync: () =>
          Promise.resolve([{ status: 'ok', id: 'XYZ' }]),
      }),
    );

    const r = await sender.enviar([
      { token: 'ExponentPushToken[a]', mensaje: mensaje('v1') },
    ]);
    expect(r).toEqual([{ ok: true, id: 'XYZ' }]);
  });

  it('traduce un ticket con error, conservando el código de Expo', async () => {
    const sender = new ExpoPushSender(
      clienteFalso({
        sendPushNotificationsAsync: () =>
          Promise.resolve([
            {
              status: 'error',
              message: 'no registrado',
              details: { error: 'DeviceNotRegistered' },
            },
          ]),
      }),
    );

    const r = await sender.enviar([
      { token: 'ExponentPushToken[a]', mensaje: mensaje('v1') },
    ]);
    expect(r).toEqual([
      { ok: false, code: 'DeviceNotRegistered', message: 'no registrado' },
    ]);
  });

  it('manda los lotes que arma el SDK y respeta el orden de la lista', async () => {
    const enviados: unknown[][] = [];
    const sender = new ExpoPushSender(
      clienteFalso({
        // Parte de dos en dos para comprobar que se concatenan en orden.
        chunkPushNotifications: (m: unknown[]) => [m.slice(0, 2), m.slice(2)],
        sendPushNotificationsAsync: (lote: unknown[]) => {
          enviados.push(lote);
          return Promise.resolve(
            lote.map((_, i) => ({
              status: 'ok',
              id: `id-${enviados.length}-${i}`,
            })),
          );
        },
      }),
    );

    const r = await sender.enviar([
      { token: 'ExponentPushToken[a]', mensaje: mensaje('v1') },
      { token: 'ExponentPushToken[b]', mensaje: mensaje('v2') },
      { token: 'ExponentPushToken[c]', mensaje: mensaje('v3') },
    ]);

    expect(enviados).toHaveLength(2);
    expect(r).toEqual([
      { ok: true, id: 'id-1-0' },
      { ok: true, id: 'id-1-1' },
      { ok: true, id: 'id-2-0' },
    ]);
  });

  it('un lote que revienta no tumba los demás: devuelve error por envío', async () => {
    const sender = new ExpoPushSender(
      clienteFalso({
        sendPushNotificationsAsync: () => Promise.reject(new Error('sin red')),
      }),
    );

    const r = await sender.enviar([
      { token: 'ExponentPushToken[a]', mensaje: mensaje('v1') },
    ]);
    expect(r).toEqual([{ ok: false, code: 'SEND_FAILED', message: 'sin red' }]);
  });

  it('devuelve el error del receipt y null cuando entregó bien', async () => {
    const sender = new ExpoPushSender(
      clienteFalso({
        getPushNotificationReceiptsAsync: () =>
          Promise.resolve({
            'tk-1': { status: 'ok' },
            'tk-2': {
              status: 'error',
              message: 'x',
              details: { error: 'DeviceNotRegistered' },
            },
          }),
      }),
    );

    expect(await sender.receipts(['tk-1', 'tk-2'])).toEqual([
      { ticketId: 'tk-1', error: null },
      { ticketId: 'tk-2', error: 'DeviceNotRegistered' },
    ]);
  });

  it('una lista vacía no llama al SDK', async () => {
    let llamado = false;
    const sender = new ExpoPushSender(
      clienteFalso({
        chunkPushNotifications: () => {
          llamado = true;
          return [];
        },
      }),
    );

    expect(await sender.enviar([])).toEqual([]);
    expect(llamado).toBe(false);
  });
});
