import { ConfigService } from '@nestjs/config';
import { FakeMailSender } from '../mail/testing/fake-mail.sender';
import { InMemoryUserRepository } from '../users/testing/in-memory-user.repository';
import type { PasswordHasher } from './domain/password-hasher';
import { PasswordResetService } from './password-reset.service';
import { InMemoryPasswordResetRepository } from './testing/in-memory-password-reset.repository';
import { InMemoryRefreshTokenRepository } from './testing/in-memory-refresh-token.repository';

// Hasher falso: determinista y rápido. El Argon2 real ya se testea aparte.
const hasher: PasswordHasher = {
  hash: (p) => Promise.resolve(`hash:${p}`),
  verify: (h, p) => Promise.resolve(h === `hash:${p}`),
};

const CORREO = 'luis@correo.com';

/** Los 6 dígitos del último correo que recibió `para`. */
function codigoRecibido(mail: FakeMailSender, para = CORREO): string {
  const texto = mail.ultimoPara(para)?.texto ?? '';
  const m = /\b(\d{6})\b/.exec(texto);
  if (!m) throw new Error(`No llegó ningún código a ${para}`);
  return m[1];
}

describe('PasswordResetService', () => {
  let users: InMemoryUserRepository;
  let resets: InMemoryPasswordResetRepository;
  let refresh: InMemoryRefreshTokenRepository;
  let mail: FakeMailSender;
  let service: PasswordResetService;
  let userId: string;

  beforeEach(async () => {
    users = new InMemoryUserRepository();
    resets = new InMemoryPasswordResetRepository();
    refresh = new InMemoryRefreshTokenRepository();
    mail = new FakeMailSender();
    service = new PasswordResetService(
      users,
      resets,
      hasher,
      refresh,
      mail,
      new ConfigService({ RESET_CODE_SECRET: 's'.repeat(32) }),
    );

    const u = await users.create({
      email: CORREO,
      cedula: 'V25481073',
      passwordHash: 'hash:Vieja#2025',
      fullName: 'Luis Guerrero',
      phone: '+58 414 528 9012',
      state: 'Zulia',
      city: 'Maracaibo',
      currency: 'BOTH',
    });
    userId = u.id;
  });

  describe('solicitarCodigo', () => {
    it('manda un código de 6 dígitos al correo de la cuenta', async () => {
      await service.solicitarCodigo(CORREO);

      expect(mail.enviados).toHaveLength(1);
      expect(codigoRecibido(mail)).toMatch(/^\d{6}$/);
    });

    // El asunto sale en la notificación de la pantalla bloqueada: con el
    // código ahí, bastaría ver el teléfono bloqueado de la víctima.
    it('no pone el código en el asunto', async () => {
      await service.solicitarCodigo(CORREO);

      expect(mail.ultimoPara(CORREO)?.asunto).not.toMatch(/\d{6}/);
    });

    // Responder distinto según exista o no la cuenta convertiría el endpoint
    // en un oráculo para saber qué correos están registrados.
    it('con un correo sin cuenta no falla ni manda nada', async () => {
      await expect(
        service.solicitarCodigo('nadie@correo.com'),
      ).resolves.toBeUndefined();
      expect(mail.enviados).toHaveLength(0);
    });

    it('no guarda el código en claro', async () => {
      await service.solicitarCodigo(CORREO);
      const codigo = codigoRecibido(mail);

      const [guardado] = [...resets.records.values()];
      expect(guardado.codeHash).not.toContain(codigo);
      expect(guardado.codeHash).toMatch(/^[0-9a-f]{64}$/);
    });

    // Si el SMTP se cae, el usuario puede pedir otro código; lo que no puede
    // pasar es que el error suba y el endpoint responda distinto que para un
    // correo sin cuenta.
    it('si el envío falla, no lanza', async () => {
      mail.fallarCon = new Error('SMTP caído');

      await expect(service.solicitarCodigo(CORREO)).resolves.toBeUndefined();
    });

    it('pedir otro código invalida el anterior', async () => {
      await service.solicitarCodigo(CORREO);
      const viejo = codigoRecibido(mail);
      await service.solicitarCodigo(CORREO);

      await expect(
        service.verificarCodigo(CORREO, viejo),
      ).rejects.toMatchObject({
        response: { error: 'INVALID_RESET_CODE' },
      });
    });
  });

  describe('verificarCodigo', () => {
    it('con el código correcto entrega un token de un solo uso', async () => {
      await service.solicitarCodigo(CORREO);

      const r = await service.verificarCodigo(CORREO, codigoRecibido(mail));

      expect(r.resetToken.length).toBeGreaterThanOrEqual(32);
      expect(r.expiresIn).toBe(600);
    });

    it('rechaza un código errado', async () => {
      await service.solicitarCodigo(CORREO);
      const bueno = codigoRecibido(mail);
      const malo = bueno === '000000' ? '111111' : '000000';

      await expect(service.verificarCodigo(CORREO, malo)).rejects.toMatchObject(
        {
          response: { error: 'INVALID_RESET_CODE' },
        },
      );
    });

    // El mismo error que un código errado: distinguirlos delataría qué
    // correos tienen cuenta.
    it('con un correo sin cuenta da el mismo error que un código errado', async () => {
      await expect(
        service.verificarCodigo('nadie@correo.com', '123456'),
      ).rejects.toMatchObject({ response: { error: 'INVALID_RESET_CODE' } });
    });

    it('rechaza un código vencido', async () => {
      await service.solicitarCodigo(CORREO);
      const codigo = codigoRecibido(mail);
      for (const r of resets.records.values())
        r.expiresAt = new Date(Date.now() - 1);

      await expect(
        service.verificarCodigo(CORREO, codigo),
      ).rejects.toMatchObject({
        response: { error: 'INVALID_RESET_CODE' },
      });
    });

    // Sin tope, un millón de combinaciones se prueban en un rato. Con cinco
    // intentos por código, adivinar tiene una probabilidad de 1 en 200.000.
    it('tras 5 intentos fallidos, ni el código correcto sirve', async () => {
      await service.solicitarCodigo(CORREO);
      const bueno = codigoRecibido(mail);
      const malo = bueno === '000000' ? '111111' : '000000';

      for (let i = 0; i < 5; i++) {
        await service.verificarCodigo(CORREO, malo).catch(() => undefined);
      }

      await expect(
        service.verificarCodigo(CORREO, bueno),
      ).rejects.toMatchObject({
        response: { error: 'INVALID_RESET_CODE' },
      });
    });

    it('sin haber pedido código, rechaza', async () => {
      await expect(
        service.verificarCodigo(CORREO, '123456'),
      ).rejects.toMatchObject({
        response: { error: 'INVALID_RESET_CODE' },
      });
    });
  });

  describe('restablecer', () => {
    const tokenVerificado = async (): Promise<string> => {
      await service.solicitarCodigo(CORREO);
      const { resetToken } = await service.verificarCodigo(
        CORREO,
        codigoRecibido(mail),
      );
      return resetToken;
    };

    it('cambia la contraseña', async () => {
      await service.restablecer(await tokenVerificado(), 'Nueva#2026');

      const u = await users.findById(userId);
      expect(u?.passwordHash).toBe('hash:Nueva#2026');
    });

    // Si alguien robó la cuenta, cambiar la contraseña tiene que echarlo.
    it('cierra todas las sesiones abiertas', async () => {
      await refresh.create({
        tokenHash: 't1',
        userId,
        expiresAt: new Date(Date.now() + 1e9),
      });
      await refresh.create({
        tokenHash: 't2',
        userId,
        expiresAt: new Date(Date.now() + 1e9),
      });

      await service.restablecer(await tokenVerificado(), 'Nueva#2026');

      const vivas = [...refresh.records.values()].filter((r) => !r.revokedAt);
      expect(vivas).toHaveLength(0);
    });

    it('el token sirve una sola vez', async () => {
      const token = await tokenVerificado();
      await service.restablecer(token, 'Nueva#2026');

      await expect(
        service.restablecer(token, 'Otra#2026x'),
      ).rejects.toMatchObject({
        response: { error: 'INVALID_RESET_TOKEN' },
      });
    });

    it('rechaza un token inventado', async () => {
      await expect(
        service.restablecer('token-que-no-existe-en-ningun-lado', 'Nueva#2026'),
      ).rejects.toMatchObject({ response: { error: 'INVALID_RESET_TOKEN' } });
    });

    it('rechaza un token vencido', async () => {
      const token = await tokenVerificado();
      for (const r of resets.records.values()) {
        r.resetExpiresAt = new Date(Date.now() - 1);
      }

      await expect(
        service.restablecer(token, 'Nueva#2026'),
      ).rejects.toMatchObject({
        response: { error: 'INVALID_RESET_TOKEN' },
      });
    });

    // Si no fue el dueño quien cambió la contraseña, este aviso es cómo se
    // entera de que alguien entró a su correo.
    it('avisa por correo que la contraseña cambió', async () => {
      await service.restablecer(await tokenVerificado(), 'Nueva#2026');

      const aviso = mail.ultimoPara(CORREO);
      expect(aviso?.asunto).toMatch(/contraseña/i);
      expect(aviso?.texto).not.toMatch(/\b\d{6}\b/);
    });
  });
});
