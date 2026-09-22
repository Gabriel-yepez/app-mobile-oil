import 'dotenv/config';
// Mismo motivo que en auth.e2e: el e2e crea más cuentas por minuto que el
// límite real. Debe fijarse ANTES de importar AppModule.
process.env.THROTTLE_AUTH_LIMIT = '1000';
// Y con esto no se manda ninguna notificación de verdad ni se registran cron.
process.env.PUSH_ENABLED = 'false';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { PrismaService } from '../src/infra/prisma/prisma.service';
import { emailE2E, limpiarUsuariosE2E } from './support/e2e-db';

const nuevoUsuario = () => ({
  fullName: 'Luis Guerrero',
  cedula: `V${Math.floor(10_000_000 + Math.random() * 89_999_999)}`,
  email: emailE2E('devices'),
  phone: '+58 414 528 9012',
  state: 'Distrito Capital',
  city: 'Caracas',
  password: 'contrasena1',
});

describe('Dispositivos para push (e2e)', () => {
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

  const TOKEN = () =>
    `ExponentPushToken[e2e-${Date.now()}-${Math.random().toString(36).slice(2)}]`;

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

  it('registra un token y responde 201', async () => {
    const jwt = await sesion();
    const token = TOKEN();

    await http()
      .post('/me/devices')
      .set('Authorization', `Bearer ${jwt}`)
      .send({ token, platform: 'ANDROID' })
      .expect(201);

    expect(await prisma.deviceToken.count({ where: { token } })).toBe(1);
  });

  it('registrar dos veces el mismo token es idempotente', async () => {
    const jwt = await sesion();
    const token = TOKEN();
    const cuerpo = { token, platform: 'IOS' };

    await http()
      .post('/me/devices')
      .set('Authorization', `Bearer ${jwt}`)
      .send(cuerpo)
      .expect(201);
    await http()
      .post('/me/devices')
      .set('Authorization', `Bearer ${jwt}`)
      .send(cuerpo)
      .expect(201);

    expect(await prisma.deviceToken.count({ where: { token } })).toBe(1);
  });

  it('rechaza un token que no tiene formato de Expo', async () => {
    const jwt = await sesion();

    await http()
      .post('/me/devices')
      .set('Authorization', `Bearer ${jwt}`)
      .send({ token: 'cualquier-cosa', platform: 'ANDROID' })
      .expect(400);
  });

  it('rechaza una plataforma desconocida', async () => {
    const jwt = await sesion();

    await http()
      .post('/me/devices')
      .set('Authorization', `Bearer ${jwt}`)
      .send({ token: TOKEN(), platform: 'WINDOWS_PHONE' })
      .expect(400);
  });

  it('da de baja el token y responde 204', async () => {
    const jwt = await sesion();
    const token = TOKEN();

    await http()
      .post('/me/devices')
      .set('Authorization', `Bearer ${jwt}`)
      .send({ token, platform: 'ANDROID' })
      .expect(201);
    await http()
      .delete(`/me/devices/${encodeURIComponent(token)}`)
      .set('Authorization', `Bearer ${jwt}`)
      .expect(204);

    expect(await prisma.deviceToken.count({ where: { token } })).toBe(0);
  });

  it('dar de baja un token que no existe también responde 204', async () => {
    const jwt = await sesion();

    await http()
      .delete(`/me/devices/${encodeURIComponent('ExponentPushToken[fantasma]')}`)
      .set('Authorization', `Bearer ${jwt}`)
      .expect(204);
  });

  // Responde 204 igual que si no existiera: no delata de quién es el token.
  it('la sesión de otro no puede dar de baja mi dispositivo', async () => {
    const mio = await sesion();
    const ajeno = await sesion();
    const token = TOKEN();

    await http()
      .post('/me/devices')
      .set('Authorization', `Bearer ${mio}`)
      .send({ token, platform: 'ANDROID' })
      .expect(201);

    await http()
      .delete(`/me/devices/${encodeURIComponent(token)}`)
      .set('Authorization', `Bearer ${ajeno}`)
      .expect(204);

    expect(await prisma.deviceToken.count({ where: { token } })).toBe(1);
  });

  it('sin sesión responde 401', async () => {
    await http()
      .post('/me/devices')
      .send({ token: TOKEN(), platform: 'ANDROID' })
      .expect(401);
  });
});
