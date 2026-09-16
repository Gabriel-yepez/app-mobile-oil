import { Module } from '@nestjs/common';
import { PrismaUserRepository } from '../../infra/prisma/prisma-user.repository';
import { USER_REPOSITORY } from './domain/user.repository';

@Module({
  providers: [
    // ───────────────────────────────────────────────────────────────────
    // ESTA es la línea. Cambiar de motor = escribir otra clase que cumpla
    // UserRepository y cambiar el useClass. Ni AuthService, ni los
    // controladores, ni los tests se tocan.
    { provide: USER_REPOSITORY, useClass: PrismaUserRepository },
    // ───────────────────────────────────────────────────────────────────
  ],
  exports: [USER_REPOSITORY],
})
export class UsersModule {}
