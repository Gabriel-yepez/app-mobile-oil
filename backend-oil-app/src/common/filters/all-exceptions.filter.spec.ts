import { ArgumentsHost, BadRequestException } from '@nestjs/common';
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
