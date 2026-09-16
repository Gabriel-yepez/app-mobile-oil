// Todo lo que tiene que ver con tokens vive acá: firmar, guardar, rotar y
// revocar. AuthService orquesta; esto es el mecanismo.
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'node:crypto';
import { Errors } from '../../common/errors';
import type { User } from '../users/domain/user';
import {
  REFRESH_TOKEN_REPOSITORY,
  type RefreshTokenRepository,
} from './domain/refresh-token.repository';

export type TokenPair = { accessToken: string; refreshToken: string };
export type AccessPayload = { sub: string; email: string };

/** Convierte "30d" / "15m" / "45s" a milisegundos. */
function ttlAMs(ttl: string): number {
  const m = /^(\d+)([smhd])$/.exec(ttl);
  if (!m) throw new Error(`TTL inválido: ${ttl}`);
  const factor = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 }[
    m[2] as 's' | 'm' | 'h' | 'd'
  ];
  return Number(m[1]) * factor;
}

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    @Inject(REFRESH_TOKEN_REPOSITORY)
    private readonly refreshRepo: RefreshTokenRepository,
  ) {}

  // SHA-256 y no Argon2: el token son 384 bits aleatorios, no una contraseña
  // adivinable. No hay diccionario que probar, así que un hash lento solo
  // gastaría CPU en cada refresco sin añadir seguridad.
  private hashear(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private firmarAccess(userId: string, email: string): string {
    const payload: AccessPayload = { sub: userId, email };
    return this.jwt.sign(payload, {
      secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      // En segundos, reusando el mismo parser que el refresh: @nestjs/jwt tipa
      // la forma "15m" con un tipo de plantilla del paquete `ms`, que un
      // string corriente no satisface. Pasar el número evita el cast y hace
      // que el TTL de access se valide igual que el de refresh.
      expiresIn: Math.floor(
        ttlAMs(this.config.get<string>('JWT_ACCESS_TTL', '15m')) / 1000,
      ),
    });
  }

  private async crearRefresh(
    userId: string,
  ): Promise<{ token: string; id: string }> {
    const token = randomBytes(48).toString('base64url');
    const expiresAt = new Date(
      Date.now() + ttlAMs(this.config.get<string>('JWT_REFRESH_TTL', '30d')),
    );
    const record = await this.refreshRepo.create({
      tokenHash: this.hashear(token),
      userId,
      expiresAt,
    });
    return { token, id: record.id };
  }

  async issuePair(user: User): Promise<TokenPair> {
    const { token } = await this.crearRefresh(user.id);
    return {
      accessToken: this.firmarAccess(user.id, user.email),
      refreshToken: token,
    };
  }

  async rotate(
    refreshToken: string,
  ): Promise<{ pair: TokenPair; userId: string }> {
    const record = await this.refreshRepo.findByHash(
      this.hashear(refreshToken),
    );
    if (!record) throw Errors.invalidRefreshToken();

    if (record.revokedAt !== null) {
      // Un token ya rotado que vuelve a presentarse significa que existen dos
      // copias: la legítima y una robada. No hay forma de saber cuál es cuál,
      // así que se caen todas las sesiones y el dueño vuelve a entrar.
      await this.refreshRepo.revokeAllForUser(record.userId);
      throw Errors.invalidRefreshToken();
    }

    if (record.expiresAt.getTime() <= Date.now())
      throw Errors.invalidRefreshToken();

    const nuevo = await this.crearRefresh(record.userId);
    await this.refreshRepo.markRotated(record.id, nuevo.id);

    // El correo va vacío en el refresco: el payload solo necesita el `sub`, y
    // la estrategia JWT relee el usuario de la base en cada petición.
    return {
      pair: {
        accessToken: this.firmarAccess(record.userId, ''),
        refreshToken: nuevo.token,
      },
      userId: record.userId,
    };
  }

  async revoke(refreshToken: string): Promise<void> {
    await this.refreshRepo.revokeByHash(this.hashear(refreshToken));
  }
}
