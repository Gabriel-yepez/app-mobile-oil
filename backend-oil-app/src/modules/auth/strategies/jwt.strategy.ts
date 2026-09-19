import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import {
  USER_REPOSITORY,
  type UserRepository,
} from '../../users/domain/user.repository';
import type { User } from '../../users/domain/user';
import type { AccessPayload } from '../token.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  // Se relee el usuario en vez de confiar solo en el payload: así una cuenta
  // borrada deja de entrar de inmediato, sin esperar a que expire el token.
  async validate(payload: AccessPayload): Promise<User> {
    const user = await this.users.findById(payload.sub);
    if (!user) throw new UnauthorizedException();
    return user;
  }
}
