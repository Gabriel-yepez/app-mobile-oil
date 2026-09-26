import 'dotenv/config';
// Ver auth.e2e-spec.ts: el e2e hace más peticiones por minuto que el límite
// real, y se sube por entorno antes de importar AppModule.
process.env.THROTTLE_AUTH_LIMIT = '1000';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { PrismaService } from '../src/infra/prisma/prisma.service';
import { MAIL_SENDER } from '../src/modules/mail/domain/mail-sender';
import { FakeMailSender } from '../src/modules/mail/testing/fake-mail.sender';
import { emailE2E, limpiarUsuariosE2E } from './support/e2e-db';

const nuevo = () => ({
  fullName: 'Luis Guerrero',
  cedula: `V${Math.floor(10_000_000 + Math.random() * 89_999_999)}`,
  email: emailE2E('reset'),
  phone: '+58 414 528 9012',
  state: 'Zulia',
  city: 'Maracaibo',
  password: 'Vieja#2025',
});

type CuerpoError = {
  statusCode: number;
  error: string;
  message: string;
  details?: string[];
};
const err = (r: request.Response): CuerpoError => r.body as CuerpoError;

describe('Recuperar contraseña (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  // Los correos se capturan en vez de mandarse: así el test lee el código.
  const mail = new FakeMailSender();
  const http = () =>
    request(app.getHttpServer() as Parameters<typeof request>[0]);

  /**
   * `/forgot` responde ANTES de generar el código (así el tiempo no delata si
   * la cuenta existe), de modo que el código llega un instante después.
   */
  async function esperarCodigo(para: string): Promise<string> {
    for (let i = 0; i < 100; i++) {
      const m = /\b(\d{6})\b/.exec(mail.ultimoPara(para)?.texto ?? '');
      if (m) return m[1];
      await new Promise((r) => setTimeout(r, 20));
    }
    throw new Error(`No llegó ningún código a ${para}`);
  }

  /** Registra una cuenta y recorre el flujo hasta tener el resetToken. */
  async function hastaElToken(): Promise<{
    datos: ReturnType<typeof nuevo>;
    refreshToken: string;
    resetToken: string;
  }> {
    const datos = nuevo();
    const reg = await http()
      .post('/api/v1/auth/register')
      .send(datos)
      .expect(201);
    await http()
      .post('/api/v1/auth/password/forgot')
      .send({ email: datos.email })
      .expect(202);
    const code = await esperarCodigo(datos.email);
    const ver = await http()
      .post('/api/v1/auth/password/verify')
      .send({ email: datos.email, code })
      .expect(200);

    return {
      datos,
      refreshToken: (reg.body as { refreshToken: string }).refreshToken,
      resetToken: (ver.body as { resetToken: string }).resetToken,
    };
  }

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MAIL_SENDER)
      .useValue(mail)
      .compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    // Escucha UNA vez y atado a 127.0.0.1, no app.init(): ver test/setup-env.ts.
    await app.listen(0, '127.0.0.1');
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await limpiarUsuariosE2E(prisma);
    await app.close();
  });

  it('flujo completo: pedir código → verificar → contraseña nueva → entrar', async () => {
    const { datos, refreshToken, resetToken } = await hastaElToken();

    await http()
      .post('/api/v1/auth/password/reset')
      .send({
        resetToken,
        password: 'Nueva#2026',
        confirmPassword: 'Nueva#2026',
      })
      .expect(204);

    // La contraseña vieja ya no sirve…
    await http()
      .post('/api/v1/auth/login')
      .send({ email: datos.email, password: datos.password })
      .expect(401);

    // …la nueva sí…
    await http()
      .post('/api/v1/auth/login')
      .send({ email: datos.email, password: 'Nueva#2026' })
      .expect(200);

    // …y la sesión que estaba abierta se cerró: si alguien había robado la
    // cuenta, cambiar la contraseña lo echa.
    await http()
      .post('/api/v1/auth/refresh')
      .send({ refreshToken })
      .expect(401);
  });

  // Mismo cuerpo exista o no la cuenta: si no, /forgot delataría qué correos
  // están registrados.
  it('/forgot responde igual con un correo sin cuenta y no manda nada', async () => {
    const existente = nuevo();
    await http().post('/api/v1/auth/register').send(existente).expect(201);
    const fantasma = emailE2E('fantasma');

    const a = await http()
      .post('/api/v1/auth/password/forgot')
      .send({ email: existente.email })
      .expect(202);
    const b = await http()
      .post('/api/v1/auth/password/forgot')
      .send({ email: fantasma })
      .expect(202);

    expect(a.body).toEqual(b.body);
    await esperarCodigo(existente.email);
    await new Promise((r) => setTimeout(r, 200));
    expect(mail.ultimoPara(fantasma)).toBeUndefined();
  });

  it('un código errado da INVALID_RESET_CODE', async () => {
    const datos = nuevo();
    await http().post('/api/v1/auth/register').send(datos).expect(201);
    await http()
      .post('/api/v1/auth/password/forgot')
      .send({ email: datos.email })
      .expect(202);
    const bueno = await esperarCodigo(datos.email);
    const malo = bueno === '000000' ? '111111' : '000000';

    await http()
      .post('/api/v1/auth/password/verify')
      .send({ email: datos.email, code: malo })
      .expect(400)
      .expect((r) => expect(err(r).error).toBe('INVALID_RESET_CODE'));
  });

  it('un código que no son 6 dígitos lo rechaza la validación', async () => {
    await http()
      .post('/api/v1/auth/password/verify')
      .send({ email: emailE2E('x'), code: '12ab' })
      .expect(400)
      .expect((r) =>
        expect(err(r).details).toContain('El código son 6 dígitos'),
      );
  });

  // Lo que pidió el negocio: la API dice QUÉ reglas no se cumplen, y todas de
  // una vez, no la primera.
  it('/reset lista TODAS las reglas de contraseña incumplidas', async () => {
    const { resetToken } = await hastaElToken();

    const r = await http()
      .post('/api/v1/auth/password/reset')
      .send({ resetToken, password: 'abcdefgh', confirmPassword: 'abcdefgh' })
      .expect(400);

    expect(err(r).error).toBe('VALIDATION_ERROR');
    expect(err(r).details).toEqual(
      expect.arrayContaining([
        'Debe incluir al menos una letra mayúscula',
        'Debe incluir al menos un número',
        'Debe incluir al menos un carácter especial',
      ]),
    );
  });

  it('/reset rechaza una confirmación que no coincide', async () => {
    const { resetToken } = await hastaElToken();

    await http()
      .post('/api/v1/auth/password/reset')
      .send({
        resetToken,
        password: 'Nueva#2026',
        confirmPassword: 'Nueva#2027',
      })
      .expect(400)
      .expect((r) =>
        expect(err(r).details).toContain('Las contraseñas no coinciden'),
      );
  });

  // Un 400 de validación no debe gastar el token: el usuario corrige la
  // contraseña y reintenta con el mismo.
  it('un intento con contraseña inválida no gasta el token', async () => {
    const { resetToken } = await hastaElToken();

    await http()
      .post('/api/v1/auth/password/reset')
      .send({ resetToken, password: 'debil', confirmPassword: 'debil' })
      .expect(400);

    await http()
      .post('/api/v1/auth/password/reset')
      .send({
        resetToken,
        password: 'Nueva#2026',
        confirmPassword: 'Nueva#2026',
      })
      .expect(204);
  });

  it('el token sirve una sola vez', async () => {
    const { resetToken } = await hastaElToken();
    const cuerpo = {
      resetToken,
      password: 'Nueva#2026',
      confirmPassword: 'Nueva#2026',
    };

    await http().post('/api/v1/auth/password/reset').send(cuerpo).expect(204);
    await http()
      .post('/api/v1/auth/password/reset')
      .send(cuerpo)
      .expect(400)
      .expect((r) => expect(err(r).error).toBe('INVALID_RESET_TOKEN'));
  });

  // La misma regla vale al crear la cuenta, con la misma respuesta.
  it('el registro también lista todas las reglas incumplidas', async () => {
    const r = await http()
      .post('/api/v1/auth/register')
      .send({ ...nuevo(), password: 'clave' })
      .expect(400);

    expect(err(r).details).toEqual(
      expect.arrayContaining([
        'Debe tener entre 8 y 72 caracteres',
        'Debe incluir al menos una letra mayúscula',
        'Debe incluir al menos un número',
        'Debe incluir al menos un carácter especial',
      ]),
    );
  });
});
