// Qué avisarle al usuario después de intentar agregar un taller. Mismo
// criterio que `../marcas/aviso.ts`; aparte solo por el texto.
import { ApiError } from '../../api/base';
import { clasificarFallo } from '../sync/runner';
import type { ApiShopCreado } from '../../api/controllers/shops.controller';
import type { Aviso } from '../marcas/aviso';

/** Con el nombre que devolvió el SERVIDOR, que es el que verán todos. */
export function avisoDeAltaTaller(r: ApiShopCreado): Aviso {
  return r.created
    ? { kind: 'ok', text: `${r.name} agregado al catálogo` }
    : { kind: 'info', text: `${r.name} ya estaba en el catálogo` };
}

/** Solo los rechazos permanentes: lo transitorio lo reintenta la cola. */
export function avisoDeFalloTaller(e: unknown): Aviso {
  if (clasificarFallo(e) !== 'permanente') return null;
  const text =
    e instanceof ApiError ? e.message : 'No se pudo agregar el taller.';
  return { kind: 'error', text };
}
