// Cliente HTTP base del que heredan todos los controladores de `api/controllers`.
//
// Se encarga de lo que ningún controlador debería repetir: la URL base, el
// Bearer, los query params, la traducción de errores del backend y el refresco
// del token cuando caduca.
import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios';
import { tokenStorage, type Tokens } from './tokens';

// Expo solo inyecta en el bundle las variables con prefijo EXPO_PUBLIC_. Por
// eso mismo NO son secretas: quedan incrustadas en el binario. Sirven para una
// URL; jamás para una clave.
const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

// En móvil una petición sin tope puede quedarse colgada indefinidamente con
// mala cobertura, y la pantalla se queda en "Entrando…" para siempre. `fetch`
// no trae timeout; axios sí, y es de las razones para usarlo.
const TIMEOUT_MS = 15_000;

const http: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: TIMEOUT_MS,
  headers: { 'Content-Type': 'application/json' },
});

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type QueryParams = Record<string, string | number | boolean | null | undefined>;

export type RequestOptions = {
  /** Se concatena a la ruta del controlador: '/login' → '/auth/login'. */
  path?: string;
  method?: HttpMethod;
  query?: QueryParams;
  body?: unknown;
  /** Cabeceras extra. Se mezclan con las de por defecto y pueden pisarlas. */
  headers?: Record<string, string>;
  /** `true` manda el Bearer y habilita el refresco automático ante un 401. */
  auth?: boolean;
};

export class ApiError extends Error {
  constructor(
    readonly status: number,
    /** Código estable del backend. La UI ramifica por ESTO, nunca por el texto. */
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export abstract class ApiClient {
  // ─────────────────────────────────────────────────────────────────────────
  // Estado COMPARTIDO por todos los controladores (de ahí que sea estático).
  //
  // Si cada instancia tuviera su propia cola, dos controladores refrescando a
  // la vez presentarían tokens rotados uno contra otro: el backend detectaría
  // el reuso, lo leería como robo y cerraría TODAS las sesiones del usuario.
  // La cola no es una optimización, es lo que impide que la app te eche de tu
  // propia cuenta.
  // ─────────────────────────────────────────────────────────────────────────
  private static refrescoEnCurso: Promise<Tokens | null> | null = null;
  private static alExpirarSesion: (() => void) | null = null;

  /** Lo usa el store de sesión para enterarse de que el refresco fracasó. */
  static setOnSessionExpired(cb: (() => void) | null): void {
    ApiClient.alExpirarSesion = cb;
  }

  /** Solo para tests: limpia el refresco en vuelo y el callback entre casos. */
  static __reset(): void {
    ApiClient.refrescoEnCurso = null;
    ApiClient.alExpirarSesion = null;
  }

  /**
   * Traduce cualquier fallo a ApiError. Es la razón de que los controladores
   * no tengan que saber nada de axios: hacia arriba solo sale ApiError.
   */
  private static aApiError(e: unknown): ApiError {
    if (axios.isAxiosError(e)) {
      // Con respuesta: el backend habló, y su cuerpo trae `error` y `message`.
      if (e.response) {
        const cuerpo = e.response.data as { error?: string; message?: string } | undefined;
        return new ApiError(
          e.response.status,
          cuerpo?.error ?? 'HTTP_ERROR',
          cuerpo?.message ?? 'Ocurrió un error inesperado.'
        );
      }
      // Sin respuesta: se agotó el tiempo. Se distingue de "sin red" porque el
      // consejo al usuario es distinto —esperar frente a revisar la conexión—
      // y porque un timeout suele significar servidor caído, no móvil sin datos.
      if (e.code === 'ECONNABORTED' || e.code === 'ETIMEDOUT') {
        return new ApiError(0, 'TIMEOUT', 'El servidor tardó demasiado. Intenta de nuevo.');
      }
    }
    return new ApiError(0, 'NETWORK_ERROR', 'No pudimos conectar. Revisa tu conexión.');
  }

  private static async refrescar(): Promise<Tokens | null> {
    const actuales = await tokenStorage.get();
    if (!actuales) return null;

    try {
      const res = await http.request<Tokens>({
        url: '/auth/refresh',
        method: 'POST',
        data: { refreshToken: actuales.refreshToken },
      });
      await tokenStorage.save(res.data);
      return res.data;
    } catch {
      await tokenStorage.clear();
      ApiClient.alExpirarSesion?.();
      return null;
    }
  }

  private static refrescarUnaVez(): Promise<Tokens | null> {
    ApiClient.refrescoEnCurso ??= ApiClient.refrescar().finally(() => {
      ApiClient.refrescoEnCurso = null;
    });
    return ApiClient.refrescoEnCurso;
  }

  /** @param ruta Prefijo del recurso, p.ej. '/auth'. */
  constructor(protected readonly ruta: string) {}

  private async enviar<T>(o: RequestOptions, token: string | null): Promise<T> {
    const config: AxiosRequestConfig = {
      url: `${this.ruta}${o.path ?? ''}`,
      method: o.method ?? 'GET',
      // axios serializa y codifica los params, y omite los nulos y los
      // indefinidos. Construir la query a mano rompería con un "+" en un
      // correo o un "&" en un filtro.
      ...(o.query ? { params: o.query } : {}),
      ...(o.body !== undefined ? { data: o.body } : {}),
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...o.headers,
      },
    };

    const res = await http.request<T>(config);
    // El 204 (logout) no trae cuerpo: axios deja `data` como cadena vacía.
    return res.status === 204 ? (undefined as T) : res.data;
  }

  protected async request<T>(opciones: RequestOptions = {}): Promise<T> {
    const tokens = opciones.auth ? await tokenStorage.get() : null;

    try {
      return await this.enviar<T>(opciones, tokens?.accessToken ?? null);
    } catch (e) {
      const esNoAutorizado = axios.isAxiosError(e) && e.response?.status === 401;

      // Solo tiene sentido refrescar si había sesión que refrescar.
      if (esNoAutorizado && opciones.auth && tokens) {
        const nuevos = await ApiClient.refrescarUnaVez();
        if (nuevos) {
          try {
            return await this.enviar<T>(opciones, nuevos.accessToken);
          } catch (reintento) {
            throw ApiClient.aApiError(reintento);
          }
        }
      }

      throw ApiClient.aApiError(e);
    }
  }

  protected get<T>(path = '', o: Omit<RequestOptions, 'path' | 'method' | 'body'> = {}) {
    return this.request<T>({ ...o, path, method: 'GET' });
  }

  protected post<T>(path = '', o: Omit<RequestOptions, 'path' | 'method'> = {}) {
    return this.request<T>({ ...o, path, method: 'POST' });
  }

  protected put<T>(path = '', o: Omit<RequestOptions, 'path' | 'method'> = {}) {
    return this.request<T>({ ...o, path, method: 'PUT' });
  }

  protected patch<T>(path = '', o: Omit<RequestOptions, 'path' | 'method'> = {}) {
    return this.request<T>({ ...o, path, method: 'PATCH' });
  }

  protected del<T>(path = '', o: Omit<RequestOptions, 'path' | 'method'> = {}) {
    return this.request<T>({ ...o, path, method: 'DELETE' });
  }
}
