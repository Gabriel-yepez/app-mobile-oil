// Cableado, no decisión: quién decide qué avisar es planPushes. Acá se
// resuelve a qué dispositivos va, qué se apaga y qué queda anotado.
import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  DEVICE_TOKEN_REPOSITORY,
  type DeviceTokenRepository,
} from './domain/device-token.repository';
import {
  NOTIFICATION_LOG_REPOSITORY,
  type NotificationLogRepository,
} from './domain/notification-log.repository';
import {
  NOTIFICATION_PREF_REPOSITORY,
  type NotificationPrefRepository,
} from './domain/notification-pref.repository';
import type { PlannerVehicle, PushMessage } from './domain/push-message';
import { planPushes } from './domain/push-planner';
import {
  PUSH_SENDER,
  type EnvioPush,
  type PushSender,
} from './domain/push-sender';

export type ResultadoDespacho = {
  planificados: number;
  enviados: number;
  fallidos: number;
  tokensApagados: number;
};

const VACIO: ResultadoDespacho = {
  planificados: 0,
  enviados: 0,
  fallidos: 0,
  tokensApagados: 0,
};

@Injectable()
export class PushDispatchService {
  private readonly log = new Logger(PushDispatchService.name);

  constructor(
    @Inject(DEVICE_TOKEN_REPOSITORY)
    private readonly devices: DeviceTokenRepository,
    @Inject(NOTIFICATION_PREF_REPOSITORY)
    private readonly prefs: NotificationPrefRepository,
    @Inject(NOTIFICATION_LOG_REPOSITORY)
    private readonly bitacora: NotificationLogRepository,
    @Inject(PUSH_SENDER) private readonly sender: PushSender,
  ) {}

  async despacharUsuario(
    userId: string,
    vehiculos: PlannerVehicle[],
    now: Date = new Date(),
  ): Promise<ResultadoDespacho> {
    const [prefs, yaEnviado] = await Promise.all([
      this.prefs.obtener(userId),
      this.bitacora.firmasDe(userId),
    ]);

    const mensajes = planPushes({
      now,
      userId,
      prefs,
      vehicles: vehiculos,
      yaEnviado,
    });
    if (mensajes.length === 0) return VACIO;

    const tokens = await this.devices.activosDe(userId);
    // Sin dispositivos NO se anota nada: anotar la firma "gastaría" el aviso, y
    // quien registre su teléfono mañana no se enteraría de un vehículo que ya
    // está vencido hoy.
    if (tokens.length === 0) return { ...VACIO, planificados: mensajes.length };

    const envios: EnvioPush[] = [];
    for (const mensaje of mensajes) {
      for (const t of tokens) envios.push({ token: t.token, mensaje });
    }

    const tickets = await this.sender.enviar(envios);

    let enviados = 0;
    let fallidos = 0;
    let tokensApagados = 0;
    // Una entrada de bitácora POR ENVÍO, no por mensaje: el receipt es por
    // ticket, y así cada uno se puede casar con el suyo. El dedupe no se
    // entera, porque `firmasDe` devuelve un Set.
    const anotar: { mensaje: PushMessage; ticketId: string; token: string }[] =
      [];

    for (let i = 0; i < envios.length; i++) {
      const ticket = tickets[i];
      const envio = envios[i];

      if (ticket?.ok) {
        enviados++;
        anotar.push({
          mensaje: envio.mensaje,
          ticketId: ticket.id,
          token: envio.token,
        });
        continue;
      }

      fallidos++;
      if (ticket?.code === 'DeviceNotRegistered') {
        await this.devices.apagar(envio.token);
        tokensApagados++;
      } else if (ticket?.code === 'InvalidCredentials') {
        // No es problema del usuario: es configuración nuestra, y sin esto
        // nadie recibe nada. Tiene que verse.
        this.log.error(`Credenciales de push inválidas: ${ticket.message}`);
      }
    }

    for (const a of anotar) {
      await this.bitacora.registrar({
        userId,
        vehicleId: a.mensaje.vehicleId,
        kind: a.mensaje.kind,
        sig: a.mensaje.sig,
        ticketId: a.ticketId,
        token: a.token,
      });
    }

    return {
      planificados: mensajes.length,
      enviados,
      fallidos,
      tokensApagados,
    };
  }
}
