import { ApiClient, ApiError } from '../base';
import { authController } from '../controllers/auth.controller';
import { tokenStorage } from '../tokens';

jest.mock('../tokens', () => ({
  tokenStorage: { get: jest.fn(), save: jest.fn(), clear: jest.fn() },
}));
const storage = tokenStorage as jest.Mocked<typeof tokenStorage>;

// Segundo controlador, solo para este test: sirve para comprobar que la cola
// de refresco se comparte entre controladores distintos y no por instancia.
class PruebaController extends ApiClient {
  constructor() {
    super('/prueba');
  }
  cosa() {
    return this.get<{ ok: boolean }>('/cosa', { auth: true });
  }
  buscar(query: Record<string, string | number | null | undefined>) {
    return this.get<unknown>('/buscar', { query });
  }
  conCabeceras(headers: Record<string, string>) {
    return this.get<unknown>('/x', { headers });
  }
}
const pruebaController = new PruebaController();

const respuesta = (status: number, body: unknown) =>
  Promise.resolve({
    status,
    ok: status >= 200 && status < 300,
    json: () => Promise.resolve(body),
  } as Response);

const llamada = (i: number) =>
  (global.fetch as jest.Mock).mock.calls[i] as [string, RequestInit];

const cabeceras = (i: number) => llamada(i)[1].headers as Record<string, string>;

describe('ApiClient', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    ApiClient.__reset();
    storage.get.mockResolvedValue({ accessToken: 'viejo', refreshToken: 'ref' });
  });

  describe('construcción de la petición', () => {
    it('concatena la ruta del controlador con la del método', async () => {
      global.fetch = jest.fn().mockReturnValue(respuesta(200, {}));

      await authController.me();

      expect(llamada(0)[0]).toContain('/auth/me');
    });

    it('manda el Bearer cuando auth es true', async () => {
      global.fetch = jest.fn().mockReturnValue(respuesta(200, {}));

      await authController.me();

      expect(cabeceras(0).Authorization).toBe('Bearer viejo');
    });

    it('no manda Bearer en las rutas públicas', async () => {
      global.fetch = jest.fn().mockReturnValue(respuesta(200, {}));

      await authController.login('a@b.c', 'clave1234');

      expect(cabeceras(0).Authorization).toBeUndefined();
    });

    // Concatenar a mano rompería con un "+" en un correo o un "&" en un filtro.
    it('codifica los query params', async () => {
      global.fetch = jest.fn().mockReturnValue(respuesta(200, {}));

      await pruebaController.buscar({ correo: 'a+b@c.com', pagina: 2 });

      const url = llamada(0)[0];
      expect(url).toContain('correo=a%2Bb%40c.com');
      expect(url).toContain('pagina=2');
    });

    // Un filtro ausente no debe viajar como la cadena "undefined".
    it('omite los query params nulos o indefinidos', async () => {
      global.fetch = jest.fn().mockReturnValue(respuesta(200, {}));

      await pruebaController.buscar({ a: 1, b: undefined, c: null });

      const url = llamada(0)[0];
      expect(url).toContain('a=1');
      expect(url).not.toContain('b=');
      expect(url).not.toContain('c=');
    });

    it('no deja "?" colgando si todos los query params se omiten', async () => {
      global.fetch = jest.fn().mockReturnValue(respuesta(200, {}));

      await pruebaController.buscar({ a: undefined });

      expect(llamada(0)[0]).not.toContain('?');
    });

    it('mezcla las cabeceras extra con las de por defecto', async () => {
      global.fetch = jest.fn().mockReturnValue(respuesta(200, {}));

      await pruebaController.conCabeceras({ 'X-Origen': 'onboarding' });

      expect(cabeceras(0)['X-Origen']).toBe('onboarding');
      expect(cabeceras(0)['Content-Type']).toBe('application/json');
    });
  });

  describe('errores', () => {
    it('convierte el error del backend en ApiError con su código', async () => {
      global.fetch = jest
        .fn()
        .mockReturnValue(
          respuesta(409, { error: 'EMAIL_TAKEN', message: 'Ese correo ya tiene una cuenta.' })
        );

      await expect(
        authController.register({
          fullName: 'L',
          cedula: 'V1',
          email: 'a@b.c',
          phone: '1',
          password: 'x',
        })
      ).rejects.toMatchObject({
        code: 'EMAIL_TAKEN',
        status: 409,
        message: 'Ese correo ya tiene una cuenta.',
      });
    });

    // Sin internet fetch lanza; el usuario merece un mensaje, no un crash.
    it('convierte un fallo de red en ApiError legible', async () => {
      global.fetch = jest.fn().mockRejectedValue(new TypeError('Network request failed'));

      await expect(authController.login('a@b.c', 'x')).rejects.toMatchObject({
        code: 'NETWORK_ERROR',
      });
    });

    // Un 204 no trae cuerpo: llamar a .json() ahí revienta.
    it('maneja el 204 del logout sin intentar parsear cuerpo', async () => {
      global.fetch = jest.fn().mockReturnValue(
        Promise.resolve({
          status: 204,
          ok: true,
          json: () => Promise.reject(new Error('sin cuerpo')),
        } as unknown as Response)
      );

      await expect(authController.logout('r')).resolves.toBeUndefined();
    });
  });

  describe('refresco del token', () => {
    it('ante 401 refresca una vez y reintenta con el token nuevo', async () => {
      global.fetch = jest
        .fn()
        .mockReturnValueOnce(respuesta(401, { error: 'X' }))
        .mockReturnValueOnce(respuesta(200, { accessToken: 'nuevo', refreshToken: 'ref2' }))
        .mockReturnValueOnce(respuesta(200, { user: { id: '1' } }));

      await authController.me();

      expect(storage.save).toHaveBeenCalledWith({
        accessToken: 'nuevo',
        refreshToken: 'ref2',
      });
      expect(cabeceras(2).Authorization).toBe('Bearer nuevo');
    });

    // EL test que justifica que la cola sea estática y no por instancia. Con
    // una cola por controlador, estos dos refrescarían en paralelo, el segundo
    // presentaría un token ya rotado, y el backend cerraría TODAS las sesiones
    // del usuario por sospecha de robo.
    it('dos CONTROLADORES distintos caducados a la vez refrescan UNA sola vez', async () => {
      const urls: string[] = [];
      global.fetch = jest.fn().mockImplementation((url: string, init: RequestInit) => {
        urls.push(url);
        if (url.endsWith('/auth/refresh')) {
          return respuesta(200, { accessToken: 'nuevo', refreshToken: 'ref2' });
        }
        const auth = (init.headers as Record<string, string>).Authorization;
        return auth === 'Bearer nuevo' ? respuesta(200, { ok: true }) : respuesta(401, { error: 'X' });
      });

      await Promise.all([authController.me(), pruebaController.cosa()]);

      expect(urls.filter((u) => u.endsWith('/auth/refresh'))).toHaveLength(1);
    });

    it('tres peticiones del mismo controlador refrescan UNA sola vez', async () => {
      const urls: string[] = [];
      global.fetch = jest.fn().mockImplementation((url: string, init: RequestInit) => {
        urls.push(url);
        if (url.endsWith('/auth/refresh')) {
          return respuesta(200, { accessToken: 'nuevo', refreshToken: 'ref2' });
        }
        const auth = (init.headers as Record<string, string>).Authorization;
        return auth === 'Bearer nuevo' ? respuesta(200, { ok: true }) : respuesta(401, { error: 'X' });
      });

      await Promise.all([authController.me(), authController.me(), authController.me()]);

      expect(urls.filter((u) => u.endsWith('/auth/refresh'))).toHaveLength(1);
    });

    it('si el refresco falla, limpia los tokens y avisa que expiró la sesión', async () => {
      const expiro = jest.fn();
      ApiClient.setOnSessionExpired(expiro);
      global.fetch = jest
        .fn()
        .mockReturnValueOnce(respuesta(401, { error: 'X' }))
        .mockReturnValueOnce(respuesta(401, { error: 'INVALID_REFRESH_TOKEN' }));

      await expect(authController.me()).rejects.toBeInstanceOf(ApiError);

      expect(storage.clear).toHaveBeenCalled();
      expect(expiro).toHaveBeenCalled();
    });

    // Sin sesión guardada no hay nada que refrescar: reintentar sería una
    // llamada perdida y un refresh con `undefined`.
    it('no intenta refrescar si no hay tokens guardados', async () => {
      storage.get.mockResolvedValue(null);
      global.fetch = jest.fn().mockReturnValue(respuesta(401, { error: 'X' }));

      await expect(authController.me()).rejects.toBeInstanceOf(ApiError);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });
});
