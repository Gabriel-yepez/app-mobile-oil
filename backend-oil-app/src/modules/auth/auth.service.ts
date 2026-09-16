import { Inject, Injectable } from '@nestjs/common';
import { Errors } from '../../common/errors';
import {
  USER_REPOSITORY,
  type UserRepository,
} from '../users/domain/user.repository';
import { PASSWORD_HASHER, type PasswordHasher } from './domain/password-hasher';
import type { LoginDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';
import { toUserResponse, type UserResponse } from './dto/user-response.dto';
import type { TokenPair, TokenService } from './token.service';

export type AuthResult = { user: UserResponse } & TokenPair;

/**
 * Hash real de Argon2id sobre una contraseña aleatoria que nadie conoce. Se
 * verifica contra él cuando el correo no está registrado, para gastar el mismo
 * tiempo que en un login real.
 *
 * Tiene que ser un hash VÁLIDO, no una cadena cualquiera: ante basura,
 * argon2.verify lanza y Argon2Hasher devuelve false en ~0.04 ms, frente a los
 * ~14 ms de una verificación de verdad. Esa diferencia volvería a delatar qué
 * correos existen, que es justo lo que este señuelo evita. Hay un test que lo
 * comprueba.
 */
export const HASH_SENUELO =
  '$argon2id$v=19$m=19456,p=1,t=2$ste1j2kViiSzDWJptjBx9Q$DboHCHaJDpHcG+eB50af4CkG1PdNxhKS+Kq5W4FZdgE';

@Injectable()
export class AuthService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    private readonly tokens: TokenService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResult> {
    // Se comprueban los dos por separado para poder decir cuál chocó: el
    // formulario necesita marcar el campo correcto.
    if (await this.users.existsByEmail(dto.email)) throw Errors.emailTaken();
    if (await this.users.existsByCedula(dto.cedula)) throw Errors.cedulaTaken();

    const user = await this.users.create({
      email: dto.email,
      cedula: dto.cedula,
      fullName: dto.fullName,
      phone: dto.phone,
      passwordHash: await this.hasher.hash(dto.password),
      state: null,
      city: null,
      currency: 'BOTH',
    });

    return {
      user: toUserResponse(user),
      ...(await this.tokens.issuePair(user)),
    };
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const user = await this.users.findByEmail(dto.email);

    // Se verifica SIEMPRE, exista o no el usuario. Salir antes por "no existe"
    // haría que esa rama respondiera mucho más rápido y delatara la cuenta.
    const ok = await this.hasher.verify(
      user?.passwordHash ?? HASH_SENUELO,
      dto.password,
    );
    if (!user || !ok) throw Errors.invalidCredentials();

    return {
      user: toUserResponse(user),
      ...(await this.tokens.issuePair(user)),
    };
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    const { pair } = await this.tokens.rotate(refreshToken);
    return pair;
  }

  logout(refreshToken: string): Promise<void> {
    return this.tokens.revoke(refreshToken);
  }
}
