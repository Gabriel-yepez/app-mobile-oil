// Se mockea la instancia de axios, no `fetch`: `base.ts` crea la suya con
// axios.create() en el cuerpo del módulo.
//
// El jest.fn se crea DENTRO de la factoría a propósito. Declararlo fuera no
// sirve: `axios.create()` se ejecuta al importar `base.ts`, o sea antes de que
// el `const` del test llegue a inicializarse, y la instancia quedaría con un
// `request` indefinido. `create` devuelve siempre la MISMA instancia para que
// el test y `base.ts` compartan el espía.
const esErrorDeAxios = (e: unknown) => Boolean((e as { isAxiosError?: boolean })?.isAxiosError);

jest.mock('axios', () => {
  const request = jest.fn();
  const instancia = { request };
  return {
    __esModule: true,
    default: { create: () => instancia, isAxiosError: esErrorDeAxios },
    isAxiosError: esErrorDeAxios,
  };
});

jest.mock('../tokens', () => ({
  tokenStorage: { get: jest.fn(), save: jest.fn(), clear: jest.fn() },
}));

import type { AxiosRequestConfig } from 'axios';
import { ApiClient, ApiError } from '../base';
import { authController } from '../controllers/auth.controller';
import { tokenStorage } from '../tokens';

const storage = tokenStorage as jest.Mocked<typeof tokenStorage>;

// El mismo objeto que usa base.ts, recuperado del módulo mockeado.
const mockRequest = (
  jest.requireMock('axios') as { default: { create: () => { request: jest.Mock } } }
).default.create().request;

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

// axios resuelve en 2xx y LANZA en el resto: al revés que fetch.
const ok = (status: number, data: unknown) => Promise.resolve({ status, data });

const httpError = (status: number, data: unknown) =>
  Promise.reject(
    Object.assign(new Error('respuesta de error'), { isAxiosError: true, response: { status, data } })
  );

const sinRed = () =>
  Promise.reject(
    Object.assign(new Error('Network Error'), { isAxiosError: true, response: undefined })
  );

const timeout = () =>
  Promise.reject(
    Object.assign(new Error('timeout'), {
      isAxiosError: true,
      response: undefined,
      code: 'ECONNABORTED',
    })
  );

const config = (i: number) => mockRequest.mock.calls[i][0] as AxiosRequestConfig;
const cabeceras = (i: number) => (config(i).headers ?? {}) as Record<string, string>;

describe('ApiClient (axios)', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    ApiClient.__reset();
    storage.get.mockResolvedValue({ accessToken: 'viejo', refreshToken: 'ref' });
  });

  describe('construcción de la petición', () => {
    it('concatena la ruta del controlador con la del método', async () => {
      mockRequest.mockImplementation(() => ok(200, {}));

      await authController.me();

      expect(config(0).url).toBe('/auth/me');
      expect(config(0).method).toBe('GET');
    });

    it('manda el Bearer cuando auth es true', async () => {
      mockRequest.mockImplementation(() => ok(200, {}));

      await authController.me();

      expect(cabeceras(0).Authorization).toBe('Bearer viejo');
    });

    it('no manda Bearer en las rutas públicas', async () => {
      mockRequest.mockImplementation(() => ok(200, {}));

      await authController.login('a@b.c', 'clave1234');

      expect(cabeceras(0).Authorization).toBeUndefined();
      expect(config(0).data).toEqual({ email: 'a@b.c', password: 'clave1234' });
    });

    // Se delega en axios la serialización: construirla a mano rompería con un
    // "+" en un correo o un "&" en un filtro.
    it('pasa los query params a axios para que los serialice', async () => {
      mockRequest.mockImplementation(() => ok(200, {}));

      await pruebaController.buscar({ correo: 'a+b@c.com', pagina: 2 });

      expect(config(0).params).toEqual({ correo: 'a+b@c.com', pagina: 2 });
    });

    it('no manda `params` si no hay query', async () => {
      mockRequest.mockImplementation(() => ok(200, {}));

      await authController.me();

      expect(config(0).params).toBeUndefined();
    });

    it('mezcla las cabeceras extra con las de por defecto', async () => {
      mockRequest.mockImplementation(() => ok(200, {}));

      await pruebaController.conCabeceras({ 'X-Origen': 'onboarding' });

      expect(cabeceras(0)['X-Origen']).toBe('onboarding');
    });
  });

  describe('errores', () => {
    // Un 400 de validación dice QUÉ campos o reglas fallaron en `details`.
    // Sin conservarlo, la app solo podría mostrar "Revisa los datos enviados".
    it('conserva los details de un error de validación', async () => {
      mockRequest.mockImplementation(() =>
        httpError(400, {
          error: 'VALIDATION_ERROR',
          message: 'Revisa los datos enviados.',
          details: [
            'Debe incluir al menos una letra mayúscula',
            'Debe incluir al menos un carácter especial',
          ],
        })
      );

      await expect(authController.me()).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
        details: [
          'Debe incluir al menos una letra mayúscula',
          'Debe incluir al menos un carácter especial',
        ],
      });
    });

    it('sin details en el cuerpo, details queda vacío', async () => {
      mockRequest.mockImplementation(() =>
        httpError(409, { error: 'EMAIL_TAKEN', message: 'Ese correo ya tiene una cuenta.' })
      );

      await expect(authController.me()).rejects.toMatchObject({ details: [] });
    });

    it('convierte el error del backend en ApiError con su código', async () => {
      mockRequest.mockImplementation(() =>
        httpError(409, { error: 'EMAIL_TAKEN', message: 'Ese correo ya tiene una cuenta.' })
      );

      await expect(
        authController.register({
          fullName: 'L',
          cedula: 'V1',
          email: 'a@b.c',
          phone: '1',
          state: 'Zulia',
          city: 'Maracaibo',
          currency: 'BOTH',
          password: 'x',
        })
      ).rejects.toMatchObject({
        code: 'EMAIL_TAKEN',
        status: 409,
        message: 'Ese correo ya tiene una cuenta.',
      });
    });

    it('convierte un fallo de red en ApiError legible', async () => {
      mockRequest.mockImplementation(() => sinRed());

      await expect(authController.login('a@b.c', 'x')).rejects.toMatchObject({
        code: 'NETWORK_ERROR',
      });
    });

    // Se distingue del corte de red porque el consejo al usuario es distinto:
    // esperar frente a revisar la conexión.
    it('distingue el timeout del corte de red', async () => {
      mockRequest.mockImplementation(() => timeout());

      await expect(authController.login('a@b.c', 'x')).rejects.toMatchObject({
        code: 'TIMEOUT',
      });
    });

    // Un 204 no trae cuerpo: axios deja `data` en cadena vacía.
    it('maneja el 204 del logout devolviendo undefined', async () => {
      mockRequest.mockImplementation(() => ok(204, ''));

      await expect(authController.logout('r')).resolves.toBeUndefined();
    });

    it('nunca deja escapar un error crudo de axios', async () => {
      mockRequest.mockImplementation(() => httpError(500, {}));

      await expect(authController.me()).rejects.toBeInstanceOf(ApiError);
    });
  });

  describe('refresco del token', () => {
    it('ante 401 refresca una vez y reintenta con el token nuevo', async () => {
      mockRequest
        .mockImplementationOnce(() => httpError(401, { error: 'X' }))
        .mockImplementationOnce(() => ok(200, { accessToken: 'nuevo', refreshToken: 'ref2' }))
        .mockImplementationOnce(() => ok(200, { user: { id: '1' } }));

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
      mockRequest.mockImplementation((c: AxiosRequestConfig) => {
        if (c.url === '/auth/refresh') {
          return ok(200, { accessToken: 'nuevo', refreshToken: 'ref2' });
        }
        const auth = (c.headers as Record<string, string>)?.Authorization;
        return auth === 'Bearer nuevo' ? ok(200, { ok: true }) : httpError(401, { error: 'X' });
      });

      await Promise.all([authController.me(), pruebaController.cosa()]);

      const refrescos = mockRequest.mock.calls.filter(
        (c) => (c[0] as AxiosRequestConfig).url === '/auth/refresh'
      );
      expect(refrescos).toHaveLength(1);
    });

    it('tres peticiones del mismo controlador refrescan UNA sola vez', async () => {
      mockRequest.mockImplementation((c: AxiosRequestConfig) => {
        if (c.url === '/auth/refresh') {
          return ok(200, { accessToken: 'nuevo', refreshToken: 'ref2' });
        }
        const auth = (c.headers as Record<string, string>)?.Authorization;
        return auth === 'Bearer nuevo' ? ok(200, { ok: true }) : httpError(401, { error: 'X' });
      });

      await Promise.all([authController.me(), authController.me(), authController.me()]);

      const refrescos = mockRequest.mock.calls.filter(
        (c) => (c[0] as AxiosRequestConfig).url === '/auth/refresh'
      );
      expect(refrescos).toHaveLength(1);
    });

    it('si el refresco falla, limpia los tokens y avisa que expiró la sesión', async () => {
      const expiro = jest.fn();
      ApiClient.setOnSessionExpired(expiro);
      mockRequest
        .mockImplementationOnce(() => httpError(401, { error: 'X' }))
        .mockImplementationOnce(() => httpError(401, { error: 'INVALID_REFRESH_TOKEN' }));

      await expect(authController.me()).rejects.toBeInstanceOf(ApiError);

      expect(storage.clear).toHaveBeenCalled();
      expect(expiro).toHaveBeenCalled();
    });

    // Sin sesión guardada no hay nada que refrescar: reintentar sería una
    // llamada perdida y un refresh con `undefined`.
    it('no intenta refrescar si no hay tokens guardados', async () => {
      storage.get.mockResolvedValue(null);
      mockRequest.mockImplementation(() => httpError(401, { error: 'X' }));

      await expect(authController.me()).rejects.toBeInstanceOf(ApiError);
      expect(mockRequest).toHaveBeenCalledTimes(1);
    });
  });
});
