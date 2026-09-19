// Envoltorio de fetch: pone el Bearer, traduce los errores del backend a algo
// que la UI pueda mostrar, y refresca el token cuando caduca.
import Constants from 'expo-constants';
import { tokenStorage, type Tokens } from './tokens';

const BASE =
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ??
  'http://localhost:3000/api/v1';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

let alExpirarSesion: (() => void) | null = null;
export function setOnSessionExpired(cb: () => void): void {
  alExpirarSesion = cb;
}

// Un único refresco en vuelo. Si tres peticiones caducan a la vez, las tres
// esperan a ESTA promesa. Disparar tres refrescos en paralelo haría que la
// rotación del backend los invalidara entre sí —el segundo presentaría un
// token ya rotado— y el backend cerraría todas las sesiones del usuario por
// sospecha de robo. Es decir: sin esta cola, abrir la app con varias
// pantallas pidiendo datos a la vez te echa de tu propia cuenta.
let refrescoEnCurso: Promise<Tokens | null> | null = null;

async function refrescar(): Promise<Tokens | null> {
  const actuales = await tokenStorage.get();
  if (!actuales) return null;

  const res = await fetch(`${BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: actuales.refreshToken }),
  });

  if (!res.ok) {
    await tokenStorage.clear();
    alExpirarSesion?.();
    return null;
  }

  const nuevos = (await res.json()) as Tokens;
  await tokenStorage.save(nuevos);
  return nuevos;
}

function refrescarUnaVez(): Promise<Tokens | null> {
  refrescoEnCurso ??= refrescar().finally(() => {
    refrescoEnCurso = null;
  });
  return refrescoEnCurso;
}

type Opciones = { method?: string; body?: unknown; auth?: boolean };

function pedir(path: string, opciones: Opciones, token: string | null): Promise<Response> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  return fetch(`${BASE}${path}`, {
    method: opciones.method ?? 'GET',
    headers,
    ...(opciones.body !== undefined ? { body: JSON.stringify(opciones.body) } : {}),
  });
}

export async function apiFetch<T>(path: string, opciones: Opciones = {}): Promise<T> {
  const tokens = opciones.auth ? await tokenStorage.get() : null;

  let res: Response;
  try {
    res = await pedir(path, opciones, tokens?.accessToken ?? null);
  } catch {
    // Sin internet fetch lanza. El usuario merece un mensaje, no un crash.
    throw new ApiError(0, 'NETWORK_ERROR', 'No pudimos conectar. Revisa tu conexión.');
  }

  // Solo tiene sentido refrescar si había sesión que refrescar.
  if (res.status === 401 && opciones.auth && tokens) {
    const nuevos = await refrescarUnaVez();
    if (nuevos) {
      try {
        res = await pedir(path, opciones, nuevos.accessToken);
      } catch {
        throw new ApiError(0, 'NETWORK_ERROR', 'No pudimos conectar. Revisa tu conexión.');
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

  // El logout responde 204 sin cuerpo: llamar a .json() ahí revienta.
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

/** Solo para tests: limpia el refresco en vuelo y el callback entre casos. */
export function __resetClient(): void {
  refrescoEnCurso = null;
  alExpirarSesion = null;
}
