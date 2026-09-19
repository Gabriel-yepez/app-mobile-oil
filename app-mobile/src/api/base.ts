// Cliente HTTP base del que heredan todos los controladores de `api/controllers`.
//
// Se encarga de lo que ningún controlador debería repetir: la URL base, el
// Bearer, los query params, la traducción de errores del backend y el refresco
// del token cuando caduca.
import { tokenStorage, type Tokens } from './tokens';

// Expo solo inyecta en el bundle las variables con prefijo EXPO_PUBLIC_. Por
// eso mismo NO son secretas: quedan incrustadas en el binario. Sirven para una
// URL; jamás para una clave.
const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

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

const ERROR_RED = () =>
  new ApiError(0, 'NETWORK_ERROR', 'No pudimos conectar. Revisa tu conexión.');

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

  private static async refrescar(): Promise<Tokens | null> {
    const actuales = await tokenStorage.get();
    if (!actuales) return null;

    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: actuales.refreshToken }),
    });

    if (!res.ok) {
      await tokenStorage.clear();
      ApiClient.alExpirarSesion?.();
      return null;
    }

    const nuevos = (await res.json()) as Tokens;
    await tokenStorage.save(nuevos);
    return nuevos;
  }

  private static refrescarUnaVez(): Promise<Tokens | null> {
    ApiClient.refrescoEnCurso ??= ApiClient.refrescar().finally(() => {
      ApiClient.refrescoEnCurso = null;
    });
    return ApiClient.refrescoEnCurso;
  }

  /** @param ruta Prefijo del recurso, p.ej. '/auth'. */
  constructor(protected readonly ruta: string) {}

  private construirUrl(path: string, query?: QueryParams): string {
    const url = `${BASE_URL}${this.ruta}${path}`;
    if (!query) return url;

    // URLSearchParams y no concatenación a mano: un correo con "+" o un filtro
    // con "&" romperían la URL si se pegaran en crudo.
    const params = new URLSearchParams();
    for (const [clave, valor] of Object.entries(query)) {
      // Los ausentes se omiten en vez de viajar como "undefined".
      if (valor === undefined || valor === null) continue;
      params.append(clave, String(valor));
    }

    const qs = params.toString();
    return qs ? `${url}?${qs}` : url;
  }

  private enviar(url: string, o: RequestOptions, token: string | null): Promise<Response> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...o.headers,
    };

    return fetch(url, {
      method: o.method ?? 'GET',
      headers,
      ...(o.body !== undefined ? { body: JSON.stringify(o.body) } : {}),
    });
  }

  protected async request<T>(opciones: RequestOptions = {}): Promise<T> {
    const url = this.construirUrl(opciones.path ?? '', opciones.query);
    const tokens = opciones.auth ? await tokenStorage.get() : null;

    let res: Response;
    try {
      res = await this.enviar(url, opciones, tokens?.accessToken ?? null);
    } catch {
      // Sin internet, fetch lanza. El usuario merece un mensaje, no un crash.
      throw ERROR_RED();
    }

    // Solo tiene sentido refrescar si había sesión que refrescar.
    if (res.status === 401 && opciones.auth && tokens) {
      const nuevos = await ApiClient.refrescarUnaVez();
      if (nuevos) {
        try {
          res = await this.enviar(url, opciones, nuevos.accessToken);
        } catch {
          throw ERROR_RED();
        }
      }
    }

    if (!res.ok) {
      const cuerpo = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };
      throw new ApiError(
        res.status,
        cuerpo.error ?? 'NETWORK_ERROR',
        cuerpo.message ?? 'No pudimos conectar. Revisa tu conexión.'
      );
    }

    // El 204 (logout) no trae cuerpo: llamar a .json() ahí revienta.
    return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
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
