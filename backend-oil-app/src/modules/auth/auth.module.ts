import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { PrismaPasswordResetRepository } from '../../infra/prisma/prisma-password-reset.repository';
import { PrismaRefreshTokenRepository } from '../../infra/prisma/prisma-refresh-token.repository';
import { MailModule } from '../mail/mail.module';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PASSWORD_HASHER } from './domain/password-hasher';
import { PASSWORD_RESET_REPOSITORY } from './domain/password-reset.repository';
import { REFRESH_TOKEN_REPOSITORY } from './domain/refresh-token.repository';
import { Argon2Hasher } from './hashing/argon2.hasher';
import { PasswordResetController } from './password-reset.controller';
import { PasswordResetService } from './password-reset.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { TokenService } from './token.service';

@Module({
  imports: [UsersModule, MailModule, PassportModule, JwtModule.register({})],
  controllers: [AuthController, PasswordResetController],
  providers: [
    AuthService,
    TokenService,
    JwtStrategy,
    PasswordResetService,
    // Las otras dos líneas intercambiables (la del motor de base de datos
    // está en UsersModule): cambiar de algoritmo de hash o de almacén de
    // tokens no obliga a tocar ningún servicio.
    { provide: PASSWORD_HASHER, useClass: Argon2Hasher },
    {
      provide: REFRESH_TOKEN_REPOSITORY,
      useClass: PrismaRefreshTokenRepository,
    },
    {
      provide: PASSWORD_RESET_REPOSITORY,
      useClass: PrismaPasswordResetRepository,
    },
  ],
})
export class AuthModule {}
