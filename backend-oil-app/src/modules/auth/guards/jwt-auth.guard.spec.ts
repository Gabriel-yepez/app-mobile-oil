import { AppError } from '../../../common/errors';
import type { User } from '../../users/domain/user';
import { JwtAuthGuard } from './jwt-auth.guard';

/** Los errores tal como los construye jsonwebtoken, que es lo que ve el guard. */
const vencido = Object.assign(new Error('jwt expired'), {
  name: 'TokenExpiredError',
});
const malFirmado = Object.assign(new Error('invalid signature'), {
  name: 'JsonWebTokenError',
});
const sinToken = Object.assign(new Error('No auth token'), { name: 'Error' });

const codigo = (fn: () => unknown): string => {
  try {
    fn();
  } catch (e) {
    const cuerpo = (e as AppError).getResponse() as { error: string };
    return cuerpo.error;
  }
  throw new Error('se esperaba una excepción y no hubo ninguna');
};

describe('JwtAuthGuard.handleRequest', () => {
  const guard = new JwtAuthGuard();

  it('deja pasar al usuario cuando el token es bueno', () => {
    const user = { id: 'u1' } as User;
    expect(guard.handleRequest(null, user, null)).toBe(user);
  });

  // El punto de todo el ejercicio: estos tres eran un solo 401 indistinguible.
  it('separa vencido, mal firmado y ausente en códigos distintos', () => {
    expect(codigo(() => guard.handleRequest(null, null, vencido))).toBe(
      'TOKEN_EXPIRED',
    );
    expect(codigo(() => guard.handleRequest(null, null, malFirmado))).toBe(
      'INVALID_TOKEN',
    );
    expect(codigo(() => guard.handleRequest(null, null, sinToken))).toBe(
      'UNAUTHORIZED',
    );
    // Sin `info` tampoco hay token que examinar.
    expect(codigo(() => guard.handleRequest(null, null, undefined))).toBe(
      'UNAUTHORIZED',
    );
  });

  // Si el guard lo reemplazara por uno propio, la app perdería el aviso de que
  // la cuenta desapareció y se pondría a refrescar en vano.
  it('respeta el error que venga de JwtStrategy.validate', () => {
    const { Errors } = jest.requireActual<
      typeof import('../../../common/errors')
    >('../../../common/errors');
    expect(
      codigo(() => guard.handleRequest(Errors.accountNotFound(), null, null)),
    ).toBe('ACCOUNT_NOT_FOUND');
  });
});
