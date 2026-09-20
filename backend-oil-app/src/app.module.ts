import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { validateEnv } from './config/env.validation';
import { PrismaModule } from './infra/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { OilModule } from './modules/oil/oil.module';
import { BrandsModule } from './modules/brands/brands.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
      cache: true,
    }),
    // Dos limitadores: 'default' para todo, y 'auth' estricto para las rutas
    // que adivinan credenciales. El controlador se salta el estricto en
    // refresh/logout/me con @SkipThrottle({ auth: true }): usarlas seguido es
    // comportamiento normal de la app, reintentar el login no lo es.
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          { name: 'default', ttl: 60_000, limit: 100 },
          {
            name: 'auth',
            ttl: 60_000,
            limit: config.get<number>('THROTTLE_AUTH_LIMIT', 5),
          },
        ],
      }),
    }),
    PrismaModule,
    AuthModule,
    OilModule,
    BrandsModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
