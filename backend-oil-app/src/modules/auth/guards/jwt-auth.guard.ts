import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Errors } from '../../../common/errors';
import type { User } from '../../users/domain/user';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  /**
   * Passport resuelve los tres fallos de token con un único 401 pelado. Acá se
   * separan, porque para la app no son el mismo problema: ante un token
   * VENCIDO tiene que refrescar y reintentar sola, sin molestar al usuario,
   * mientras que ante uno que FALTA o está MAL FIRMADO no hay nada que
   * renovar y toca mandar al login. Con un solo código la app no puede saber
   * cuál de los dos caminos tomar.
   *
   * El motivo viene en `info`, que passport-jwt rellena con el error de
   * jsonwebtoken. Se discrimina por `name` y no importando `TokenExpiredError`
   * a propósito: `jsonwebtoken` es una dependencia transitiva (entra por
   * @nestjs/jwt), y con el node_modules estricto de pnpm importarla directo
   * rompería la instalación en cuanto cambie ese árbol.
   */
  handleRequest<TUser = User>(
    err: unknown,
    user: unknown,
    info: unknown,
  ): TUser {
    // Lo que lanzó JwtStrategy.validate (ACCOUNT_NOT_FOUND) ya trae su propio
    // código: se deja pasar tal cual en vez de aplastarlo con uno genérico.
    // Si por lo que sea no fuera un Error, no se relanza en crudo: acabaría en
    // la rama de "inesperado" del filtro y saldría como un 500.
    if (err) throw err instanceof Error ? err : Errors.invalidToken();
    if (user) return user as TUser;

    if (info instanceof Error) {
      if (info.name === 'TokenExpiredError') throw Errors.tokenExpired();
      // "No auth token" es literal de passport-jwt cuando no vino el header.
      if (info.message !== 'No auth token') throw Errors.invalidToken();
    }
    throw Errors.missingToken();
  }
}
