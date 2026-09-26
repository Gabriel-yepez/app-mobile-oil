// ÚNICO archivo del backend que sabe leer la respuesta de ve.dolarapi.com.
// La URL viene de BCV_RATE_URL: un proveedor con la misma forma de respuesta
// se cambia desde el .env; uno con otra forma, reemplazando este adaptador.
// En los dos casos la app no se entera: habla con nuestro /exchange-rate,
// nunca con el tercero.
//
// Se eligió dolarapi porque no pide clave y su fuente "oficial" es la tasa que
// publica el BCV. bcv.org.ve no tiene API: habría que raspar el HTML, y su
// certificado TLS falla con frecuencia.
import type {
  TasaBcv,
  TasaSource,
} from '../../modules/exchange-rate/domain/tasa-source';

/** Menor que el timeout de 15 s de la app: si el proveedor se cuelga, el
 *  servidor todavía alcanza a contestar con la última tasa conocida. */
const TIMEOUT_MS = 8_000;

type RespuestaDolarApi = {
  promedio?: unknown;
  fechaActualizacion?: unknown;
};

// Sin @Injectable: lo construye la factory del módulo con la URL del entorno.
// Con el decorador, Nest intentaría resolver `url` y `fetchFn` como
// dependencias y fallaría al arrancar.
export class DolarApiTasaSource implements TasaSource {
  // Recibe `fetch` para poder inyectar un doble en los tests.
  constructor(
    private readonly url: string,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  async tasaBcv(): Promise<TasaBcv> {
    const res = await this.fetchFn(this.url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`${this.url} respondió ${res.status}`);

    const body = (await res.json()) as RespuestaDolarApi;
    const bsPorUsd = body.promedio;
    const vigente = new Date(String(body.fechaActualizacion));

    // Mejor fallar y servir la tasa anterior que multiplicar gastos por algo
    // que no es un número.
    if (
      typeof bsPorUsd !== 'number' ||
      !Number.isFinite(bsPorUsd) ||
      bsPorUsd <= 0
    ) {
      throw new Error(
        `dolarapi devolvió un promedio inválido: ${String(bsPorUsd)}`,
      );
    }
    if (Number.isNaN(vigente.getTime())) {
      throw new Error(
        `dolarapi devolvió una fecha inválida: ${String(body.fechaActualizacion)}`,
      );
    }

    return { bsPorUsd, vigente };
  }
}
