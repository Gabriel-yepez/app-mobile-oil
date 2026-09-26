import type { ConfigService } from '@nestjs/config';
import { AppError } from '../../../common/errors';
import { InMemoryUserRepository } from '../../users/testing/in-memory-user.repository';
import type { NewUser } from '../../users/domain/user';
import { JwtStrategy } from './jwt.strategy';

const config = {
  getOrThrow: () => 'a'.repeat(32),
} as unknown as ConfigService;

const nuevo = (): NewUser => ({
  email: 'luis@correo.com',
  cedula: 'V25481073',
  passwordHash: 'hash',
  fullName: 'Luis Guerrero',
  phone: '+58 414 528 9012',
  state: null,
  city: null,
  currency: 'BOTH',
});

describe('JwtStrategy.validate', () => {
  it('devuelve el usuario releído de la base, no el del payload', async () => {
    const users = new InMemoryUserRepository();
    const creado = await users.create(nuevo());
    const strategy = new JwtStrategy(config, users);

    // El correo del payload va a propósito desactualizado: el que debe salir
    // es el del almacén. Es lo que hace que un cambio de datos se refleje sin
    // esperar a que expire el token.
    await expect(
      strategy.validate({ sub: creado.id, email: 'viejo@correo.com' }),
    ).resolves.toMatchObject({ id: creado.id, email: 'luis@correo.com' });
  });

  // Token bien firmado y sin vencer, pero la cuenta ya no está. Tiene código
  // propio para que la app no gaste un viaje intentando /auth/refresh.
  it('lanza ACCOUNT_NOT_FOUND cuando la cuenta ya no existe', async () => {
    const strategy = new JwtStrategy(config, new InMemoryUserRepository());

    const fallo = strategy.validate({
      sub: '00000000-0000-0000-0000-000000000000',
      email: 'borrado@correo.com',
    });

    await expect(fallo).rejects.toBeInstanceOf(AppError);
    await fallo.catch((e: AppError) => {
      expect(e.getStatus()).toBe(401);
      expect(e.getResponse()).toMatchObject({
        error: 'ACCOUNT_NOT_FOUND',
        message: 'Tu cuenta ya no está registrada.',
      });
    });
  });
});
