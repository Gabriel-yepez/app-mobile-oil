import {
  ArgumentsHost,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';
import { Errors } from '../errors';

function hostFalso() {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ url: '/x', method: 'GET' }),
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
}

describe('AllExceptionsFilter', () => {
  const filtro = new AllExceptionsFilter();

  it('da forma uniforme a un error de negocio', () => {
    const { host, status, json } = hostFalso();
    filtro.catch(Errors.emailTaken(), host);

    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 409, error: 'EMAIL_TAKEN' }),
    );
  });

  it('traduce el error del ValidationPipe a VALIDATION_ERROR con el detalle', () => {
    const { host, json } = hostFalso();
    filtro.catch(new BadRequestException(['email debe ser un correo']), host);

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'VALIDATION_ERROR',
        details: ['email debe ser un correo'],
      }),
    );
  });

  // El guard de Passport no pasa por Errors: su 401 llega como
  // UnauthorizedException pelada, y antes caía en la rama genérica con el
  // texto de error interno, que no le dice nada al usuario.
  it('traduce el 401 del guard a UNAUTHORIZED con un mensaje entendible', () => {
    const { host, status, json } = hostFalso();
    filtro.catch(new UnauthorizedException(), host);

    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 401,
        error: 'UNAUTHORIZED',
        message: 'Acceso no autorizado, falta token',
      }),
    );
  });

  // La rama nueva va DESPUÉS de la de AppError, y tiene que quedarse ahí: si
  // se adelantara, se tragaría los 401 de negocio y la app perdería la
  // diferencia entre "credenciales malas" y "sesión vencida".
  it('no pisa los 401 de negocio, que conservan su código propio', () => {
    const credenciales = hostFalso();
    filtro.catch(Errors.invalidCredentials(), credenciales.host);
    expect(credenciales.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 401,
        error: 'INVALID_CREDENTIALS',
      }),
    );

    const refresh = hostFalso();
    filtro.catch(Errors.invalidRefreshToken(), refresh.host);
    expect(refresh.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 401,
        error: 'INVALID_REFRESH_TOKEN',
      }),
    );
  });

  // Un stack trace en la respuesta le regala al atacante el mapa de la casa.
  it('no filtra detalles internos en un error inesperado', () => {
    const { host, status, json } = hostFalso();
    filtro.catch(
      new Error('la conexión a la base explotó en la tabla users'),
      host,
    );

    expect(status).toHaveBeenCalledWith(500);
    const cuerpo = (json.mock.calls[0] as unknown[])[0] as Record<
      string,
      unknown
    >;
    expect(cuerpo.error).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(cuerpo)).not.toContain('tabla users');
  });
});
