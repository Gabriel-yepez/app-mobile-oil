// Una sola forma de error para toda la API. La app ramifica por `error`.
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AppError } from '../errors';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    let status: HttpStatus = HttpStatus.INTERNAL_SERVER_ERROR;
    let error = 'INTERNAL_ERROR';
    let message = 'Ocurrió un error inesperado.';
    let details: string[] | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const cuerpo: unknown = exception.getResponse();

      // Se discrimina por TIPO, no por la forma del cuerpo: las excepciones
      // propias de Nest (BadRequestException y compañía) también traen una
      // clave `error` —con valor "Bad Request"—, así que mirar solo la forma
      // se traga los errores de validación y los reporta con ese texto.
      if (exception instanceof AppError) {
        const c = exception.getResponse() as { error: string; message: string };
        error = c.error;
        message = c.message;
      } else if (status === HttpStatus.BAD_REQUEST) {
        // Viene del ValidationPipe: su `message` es el array de fallos.
        const c = cuerpo as { message?: string | string[] };
        error = 'VALIDATION_ERROR';
        message = 'Revisa los datos enviados.';
        details = Array.isArray(c.message) ? c.message : [String(c.message)];
      } else if (status === HttpStatus.TOO_MANY_REQUESTS) {
        error = 'TOO_MANY_REQUESTS';
        message = 'Demasiados intentos. Espera un momento.';
      } else {
        error = 'HTTP_ERROR';
        message = typeof cuerpo === 'string' ? cuerpo : message;
      }
    } else {
      // Inesperado: al log va todo, a la respuesta nada. Un stack trace en el
      // cuerpo le entrega al atacante la estructura interna.
      this.logger.error(
        `${req.method} ${req.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    res.status(status).json({
      statusCode: status,
      error,
      message,
      ...(details ? { details } : {}),
      timestamp: new Date().toISOString(),
    });
  }
}
