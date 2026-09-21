// ÚNICO archivo del backend que importa expo-server-sdk. Todo lo demás habla
// con el puerto PUSH_SENDER, y por eso ningún test sale a la red.
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
// SOLO tipos. expo-server-sdk 7 es ESM puro ("type": "module") y este backend
// compila a CommonJS: un `import` normal se emite como `require` y revienta al
// cargarlo, además de tumbar a Jest, que no puede parsear el paquete. La
// instancia se crea con `import()` dinámico en `desdeConfig`, que es la vía
// soportada para consumir ESM desde CommonJS y la que Jest nunca ejecuta,
// porque los tests inyectan un doble del cliente.
import type { Expo, ExpoPushMessage } from 'expo-server-sdk';
import type {
  EnvioPush,
  PushReceipt,
  PushSender,
  PushTicket,
} from '../../modules/notifications/domain/push-sender';

/** El canal de Android que la app declara en app.json. */
const CANAL_ANDROID = 'oil-reminders';

@Injectable()
export class ExpoPushSender implements PushSender {
  // Recibe el cliente ya armado para poder inyectar un doble en los tests. En
  // la app real lo construye `desdeConfig` con el access token.
  constructor(private readonly expo: Expo) {}

  static async desdeConfig(config: ConfigService): Promise<ExpoPushSender> {
    const { Expo } = await import('expo-server-sdk');
    const accessToken = config.get<string>('EXPO_ACCESS_TOKEN');
    // Sin el token el envío igual funciona, pero cualquiera que consiga un
    // ExpoPushToken de la app puede mandarle notificaciones a los usuarios
    // haciéndose pasar por nosotros. En producción debe estar.
    //
    // No se declara `useFcmV1`: en expo-server-sdk 7 esa opción ya no existe
    // porque FCM v1 es el único camino, y el constructor la rechaza.
    return new ExpoPushSender(new Expo(accessToken ? { accessToken } : {}));
  }

  async enviar(envios: EnvioPush[]): Promise<PushTicket[]> {
    if (envios.length === 0) return [];

    const mensajes: ExpoPushMessage[] = envios.map(({ token, mensaje }) => ({
      to: token,
      title: mensaje.title,
      body: mensaje.body,
      data: mensaje.data,
      sound: 'default',
      channelId: CANAL_ANDROID,
    }));

    const tickets: PushTicket[] = [];
    for (const lote of this.expo.chunkPushNotifications(mensajes)) {
      try {
        const res = await this.expo.sendPushNotificationsAsync(lote);
        for (const t of res) {
          tickets.push(
            t.status === 'ok'
              ? { ok: true, id: t.id }
              : {
                  ok: false,
                  code: t.details?.error ?? 'UNKNOWN',
                  message: t.message,
                },
          );
        }
      } catch (e) {
        // Un lote caído no puede tumbar los demás: se marcan sus envíos como
        // fallidos y el barrido de mañana los vuelve a intentar.
        const message = e instanceof Error ? e.message : 'error desconocido';
        for (let i = 0; i < lote.length; i++) {
          tickets.push({ ok: false, code: 'SEND_FAILED', message });
        }
      }
    }
    return tickets;
  }

  async receipts(ticketIds: string[]): Promise<PushReceipt[]> {
    if (ticketIds.length === 0) return [];

    const out: PushReceipt[] = [];
    for (const lote of this.expo.chunkPushNotificationReceiptIds(ticketIds)) {
      try {
        const res = await this.expo.getPushNotificationReceiptsAsync(lote);
        for (const [ticketId, r] of Object.entries(res)) {
          out.push({
            ticketId,
            error: r.status === 'ok' ? null : (r.details?.error ?? 'UNKNOWN'),
          });
        }
      } catch {
        // Sin receipt no se marca nada: queda pendiente y se reintenta en la
        // corrida siguiente.
      }
    }
    return out;
  }
}
