import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { DOCS_PATH, setupSwagger } from './swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.setGlobalPrefix('api/v1');

  // Swagger UI es la única página HTML que sirve este backend, y se apoya en
  // scripts y estilos en línea que la CSP por defecto de helmet bloquea: sin
  // esta excepción la documentación carga en blanco. Se relaja SOLO en esa
  // ruta; el resto de la API conserva la política estricta.
  const helmetEstricto = helmet();
  const helmetDocs = helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        'script-src': ["'self'", "'unsafe-inline'"],
        'style-src': ["'self'", "'unsafe-inline'"],
        'img-src': ["'self'", 'data:', 'https://validator.swagger.io'],
      },
    },
  });
  app.use((req: Request, res: Response, next: NextFunction) =>
    req.path.startsWith(`/${DOCS_PATH}`)
      ? helmetDocs(req, res, next)
      : helmetEstricto(req, res, next),
  );

  const origins = config.get<string>('CORS_ORIGINS', '');
  app.enableCors({
    origin: origins ? origins.split(',').map((o) => o.trim()) : true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // borra lo que no está en el DTO
      forbidNonWhitelisted: true, // y si viene de más, rechaza en vez de ignorar
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  // La documentación se monta DESPUÉS del pipe y el filtro a propósito: así
  // el "Try it out" de la UI pega contra la misma cadena que un cliente real
  // y los errores que muestra son los de verdad, no una versión sin filtrar.
  // Se puede apagar por entorno para no publicarla en producción.
  if (config.get<boolean>('SWAGGER_ENABLED', true)) setupSwagger(app);

  const port = config.get<number>('PORT', 3000);
  await app.listen(port);
}
void bootstrap();
