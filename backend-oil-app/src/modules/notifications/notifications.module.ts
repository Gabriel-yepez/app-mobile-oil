import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ExpoPushSender } from '../../infra/expo/expo-push.sender';
import { PrismaDeviceTokenRepository } from '../../infra/prisma/prisma-device-token.repository';
import { PrismaNotificationLogRepository } from '../../infra/prisma/prisma-notification-log.repository';
import { PrismaNotificationPrefRepository } from '../../infra/prisma/prisma-notification-pref.repository';
import { NoopPushSender } from '../../infra/push/noop-push.sender';
import { OilModule } from '../oil/oil.module';
import { DEVICE_TOKEN_REPOSITORY } from './domain/device-token.repository';
import { NOTIFICATION_LOG_REPOSITORY } from './domain/notification-log.repository';
import { NOTIFICATION_PREF_REPOSITORY } from './domain/notification-pref.repository';
import { PUSH_SENDER } from './domain/push-sender';
import { NotificationsCron } from './notifications.cron';
import { PushDispatchService } from './push-dispatch.service';
import { PushSweepService } from './push-sweep.service';
import { ReceiptsService } from './receipts.service';

@Module({
  // El barrido necesita los tres repositorios del módulo oil.
  imports: [OilModule],
  providers: [
    PushDispatchService,
    PushSweepService,
    ReceiptsService,
    NotificationsCron,
    // ───────────────────────────────────────────────────────────────────
    // Mismo criterio que OilModule: los servicios piden el token, nunca la
    // clase concreta. Cambiar de motor es cambiar estos useClass.
    { provide: DEVICE_TOKEN_REPOSITORY, useClass: PrismaDeviceTokenRepository },
    {
      provide: NOTIFICATION_PREF_REPOSITORY,
      useClass: PrismaNotificationPrefRepository,
    },
    {
      provide: NOTIFICATION_LOG_REPOSITORY,
      useClass: PrismaNotificationLogRepository,
    },
    // ───────────────────────────────────────────────────────────────────
    {
      provide: PUSH_SENDER,
      inject: [ConfigService],
      // PUSH_ENABLED decide QUIÉN emite, no solo si hay cron: apagado, se
      // inyecta el emisor que no emite. Así arrancar la app en desarrollo o
      // correr los e2e no puede mandarle una notificación real a nadie, y de
      // paso el SDK de Expo —que es ESM— ni siquiera se carga.
      //
      // La factory es asíncrona porque ese import() es dinámico. Nest lo
      // resuelve antes de instanciar a quien dependa del token.
      useFactory: (config: ConfigService) =>
        config.get<boolean>('PUSH_ENABLED')
          ? ExpoPushSender.desdeConfig(config)
          : new NoopPushSender(),
    },
  ],
  exports: [PushDispatchService, PushSweepService],
})
export class NotificationsModule {}
