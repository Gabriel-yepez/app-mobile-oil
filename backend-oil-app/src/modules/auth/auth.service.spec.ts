import { AuthService, HASH_SENUELO } from './auth.service';
import { InMemoryUserRepository } from '../users/testing/in-memory-user.repository';
import { Argon2Hasher } from './hashing/argon2.hasher';
import type { PasswordHasher } from './domain/password-hasher';
import type { TokenService } from './token.service';
import type { RegisterDto } from './dto/register.dto';

// Hasher falso: determinista y rápido. El Argon2 real ya se testea aparte.
const hasher: PasswordHasher = {
  hash: (p) => Promise.resolve(`hash:${p}`),
  verify: (h, p) => Promise.resolve(h === `hash:${p}`),
};

const registro = (over: Partial<RegisterDto> = {}): RegisterDto => ({
  fullName: 'Luis Guerrero',
  cedula: 'V25481073',
  email: 'luis@correo.com',
  phone: '+58 414 528 9012',
  password: 'contrasena1',
  ...over,
});

describe('AuthService', () => {
  let users: InMemoryUserRepository;
  let tokens: { issuePair: jest.Mock; rotate: jest.Mock; revoke: jest.Mock };
  let service: AuthService;

  beforeEach(() => {
    users = new InMemoryUserRepository();
    tokens = {
      issuePair: jest
        .fn()
        .mockResolvedValue({ accessToken: 'acc', refreshToken: 'ref' }),
      rotate: jest.fn(),
      revoke: jest.fn().mockResolvedValue(undefined),
    };
    service = new AuthService(users, hasher, tokens as unknown as TokenService);
  });

  describe('register', () => {
    it('crea el usuario y devuelve el par de tokens', async () => {
      const r = await service.register(registro());

      expect(r.accessToken).toBe('acc');
      expect(r.user.email).toBe('luis@correo.com');
      await expect(users.existsByEmail('luis@correo.com')).resolves.toBe(true);
    });

    // Un passwordHash filtrado en la respuesta es un regalo al atacante.
    it('nunca devuelve el hash de la contraseña', async () => {
      const r = await service.register(registro());
      expect(JSON.stringify(r)).not.toContain('hash:');
      expect(r.user).not.toHaveProperty('passwordHash');
    });

    it('guarda la contraseña hasheada, jamás en claro', async () => {
      await service.register(registro());
      const guardado = await users.findByEmail('luis@correo.com');
      expect(guardado?.passwordHash).toBe('hash:contrasena1');
    });

    it('rechaza correo duplicado con EMAIL_TAKEN', async () => {
      await service.register(registro());
      await expect(
        service.register(registro({ cedula: 'V99999999' })),
      ).rejects.toMatchObject({ response: { error: 'EMAIL_TAKEN' } });
    });

    it('rechaza cédula duplicada con CEDULA_TAKEN', async () => {
      await service.register(registro());
      await expect(
        service.register(registro({ email: 'otro@correo.com' })),
      ).rejects.toMatchObject({ response: { error: 'CEDULA_TAKEN' } });
    });
  });

  describe('login', () => {
    beforeEach(async () => {
      await service.register(registro());
    });

    it('entra con credenciales correctas', async () => {
      const r = await service.login({
        email: 'luis@correo.com',
        password: 'contrasena1',
      });
      expect(r.accessToken).toBe('acc');
      expect(r.user.fullName).toBe('Luis Guerrero');
    });

    // Distinguir los dos casos convierte el login en un oráculo para saber qué
    // correos están registrados.
    it('da el MISMO error con contraseña errada que con correo inexistente', async () => {
      const malaClave: unknown = await service
        .login({ email: 'luis@correo.com', password: 'otra1234' })
        .catch((e: { response: unknown }) => e.response);
      const noExiste: unknown = await service
        .login({ email: 'nadie@correo.com', password: 'contrasena1' })
        .catch((e: { response: unknown }) => e.response);

      expect(malaClave).toEqual(noExiste);
      expect(malaClave).toMatchObject({ error: 'INVALID_CREDENTIALS' });
    });

    // Si con correo inexistente se respondiera sin verificar nada, el tiempo de
    // respuesta delataría qué correos existen.
    it('verifica contra un hash señuelo cuando el correo no existe', async () => {
      const espia = jest.spyOn(hasher, 'verify');
      await service
        .login({ email: 'nadie@correo.com', password: 'x' })
        .catch(() => undefined);

      expect(espia).toHaveBeenCalledWith(HASH_SENUELO, 'x');
      espia.mockRestore();
    });
  });

  // El señuelo SOLO cumple su función si es un hash argon2 válido. Si estuviera
  // corrupto, argon2.verify lanzaría y Argon2Hasher devolvería false al
  // instante (~0.04ms frente a ~14ms de una verificación real): el tiempo de
  // respuesta seguiría delatando qué correos no existen.
  describe('HASH_SENUELO', () => {
    it('es un hash argon2id válido, no una cadena inventada', async () => {
      expect(HASH_SENUELO).toMatch(/^\$argon2id\$/);
      await expect(
        new Argon2Hasher().verify(HASH_SENUELO, 'cualquiera'),
      ).resolves.toBe(false);
    });
  });
});
