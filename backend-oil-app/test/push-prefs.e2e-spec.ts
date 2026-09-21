import 'dotenv/config';
process.env.THROTTLE_AUTH_LIMIT = '1000';
process.env.PUSH_ENABLED = 'false';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { PrismaService } from '../src/infra/prisma/prisma.service';
import { DEFAULT_PREFS } from '../src/modules/notifications/domain/push-message';
import { emailE2E, limpiarUsuariosE2E } from './support/e2e-db';

const nuevoUsuario = () => ({
  fullName: 'Luis Guerrero',
  cedula: `V${Math.floor(10_000_000 + Math.random() * 89_999_999)}`,
  email: emailE2E('prefs'),
  phone: '+58 414 528 9012',
  state: 'Distrito Capital',
  city: 'Caracas',
  password: 'contrasena1',
});

describe('Preferencias de notificación (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const http = () =>
    request(app.getHttpServer() as Parameters<typeof request>[0]);

  const sesion = async (): Promise<string> => {
    const r = await http()
      .post('/auth/register')
      .send(nuevoUsuario())
      .expect(201);
    return (r.body as { accessToken: string }).accessToken;
  };

  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = mod.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await limpiarUsuariosE2E(prisma);
    await app.close();
  });

  it('quien nunca las tocó recibe los valores por defecto', async () => {
    const jwt = await sesion();

    const r = await http()
      .get('/me/notification-prefs')
      .set('Authorization', `Bearer ${jwt}`)
      .expect(200);

    expect(r.body).toEqual(DEFAULT_PREFS);
  });

  it('leerlas no crea la fila', async () => {
    const jwt = await sesion();
    const me = await http()
      .get('/auth/me')
      .set('Authorization', `Bearer ${jwt}`)
      .expect(200);
    const userId = (me.body as { id: string }).id;

    await http()
      .get('/me/notification-prefs')
      .set('Authorization', `Bearer ${jwt}`)
      .expect(200);

    expect(await prisma.notificationPref.count({ where: { userId } })).toBe(0);
  });

  it('el PATCH parcial no pisa lo que no vino', async () => {
    const jwt = await sesion();

    await http()
      .patch('/me/notification-prefs')
      .set('Authorization', `Bearer ${jwt}`)
      .send({ warnThresholdKm: 300 })
      .expect(200);
    const r = await http()
      .patch('/me/notification-prefs')
      .set('Authorization', `Bearer ${jwt}`)
      .send({ checkinEnabled: false })
      .expect(200);

    expect(r.body).toEqual({
      ...DEFAULT_PREFS,
      warnThresholdKm: 300,
      checkinEnabled: false,
    });
  });

  it('rechaza un umbral fuera de rango', async () => {
    const jwt = await sesion();

    await http()
      .patch('/me/notification-prefs')
      .set('Authorization', `Bearer ${jwt}`)
      .send({ warnThresholdKm: 99 })
      .expect(400);
  });

  it('sin sesión responde 401', async () => {
    await http().get('/me/notification-prefs').expect(401);
  });
});
