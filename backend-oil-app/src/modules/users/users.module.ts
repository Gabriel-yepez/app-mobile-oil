import { Module } from '@nestjs/common';
import { PrismaUserRepository } from '../../infra/prisma/prisma-user.repository';
import { USER_REPOSITORY } from './domain/user.repository';
import { ProfileService } from './profile.service';

@Module({
  providers: [
    // ───────────────────────────────────────────────────────────────────
    // ESTA es la línea. Cambiar de motor = escribir otra clase que cumpla
    // UserRepository y cambiar el useClass. Ni AuthService, ni los
    // controladores, ni los tests se tocan.
    { provide: USER_REPOSITORY, useClass: PrismaUserRepository },
    // ───────────────────────────────────────────────────────────────────
    ProfileService,
  ],
  // ProfileService sale exportado porque quien lo expone por HTTP es
  // AuthController, en /auth/me, al lado del GET del mismo recurso. No lleva
  // controlador propio: un PATCH /users/me obligaría a UsersModule a importar
  // AuthModule por el guard, y AuthModule ya importa a UsersModule — la
  // dependencia circular clásica de Nest.
  exports: [USER_REPOSITORY, ProfileService],
})
export class UsersModule {}
