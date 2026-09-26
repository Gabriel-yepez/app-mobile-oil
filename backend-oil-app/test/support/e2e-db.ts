// Los e2e corren contra la MISMA base que el desarrollo, así que cada cuenta
// que registran se queda ahí para siempre si nadie la borra. Doscientos
// usuarios huérfanos no rompen ningún test hoy, pero ensucian cualquier
// consulta manual y el día que alguien escriba un test que asuma "el único
// vehículo de la base" muerden sin avisar.
//
// La regla: toda cuenta de prueba vive bajo un dominio que ningún usuario real
// va a usar nunca. El barrido borra POR ESE DOMINIO y no por los ids que la
// corrida fue anotando, así que también se lleva lo que dejó una corrida
// anterior que se cayó a la mitad — que es justamente cuando la basura entra.
import type { PrismaService } from '../../src/infra/prisma/prisma.service';

export const DOMINIO_E2E = 'e2e.local';

/** `emailE2E('oil')` → `oil-1789879324-472913@e2e.local`. */
export const emailE2E = (prefijo: string): string =>
  `${prefijo}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@${DOMINIO_E2E}`;

/**
 * Borra toda cuenta de prueba y lo que cuelgue de ella.
 *
 * Un solo `deleteMany` alcanza: el esquema encadena `onDelete: Cascade` desde
 * `User` hacia `RefreshToken` y `Vehicle`, y desde `Vehicle` hacia `OilChange`
 * y `OdometerReading`. Devuelve cuántas cuentas se llevó por si un test quiere
 * afirmar sobre eso.
 */
export async function limpiarUsuariosE2E(
  prisma: PrismaService,
): Promise<number> {
  const { count } = await prisma.user.deleteMany({
    where: { email: { endsWith: `@${DOMINIO_E2E}` } },
  });
  return count;
}
