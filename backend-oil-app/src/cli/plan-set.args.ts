// Los argumentos de `pnpm plan:set`. Aparte del script para poder probarlos
// sin base de datos.
import type { PlanId } from '../modules/subscriptions/domain/plans';

export const USO =
  'Uso: pnpm plan:set <correo> <FREE|PRO> [--hasta AAAA-MM-DD]\n' +
  '  Sin --hasta, el Pro no vence. --hasta incluye ese día completo (UTC).';

export type PlanSetArgs = {
  email: string;
  plan: PlanId;
  expiresAt: Date | null;
};

export function parsearArgs(argv: string[]): PlanSetArgs {
  const [correo, planCrudo, bandera, fecha, ...sobra] = argv;
  const falla = (motivo: string) => new Error(`${motivo}\n${USO}`);

  const email = correo?.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw falla('Falta el correo o no es válido.');
  }

  const plan = planCrudo?.toUpperCase();
  if (plan !== 'FREE' && plan !== 'PRO') {
    throw falla('El plan tiene que ser FREE o PRO.');
  }

  if (sobra.length > 0 || (bandera !== undefined && bandera !== '--hasta')) {
    throw falla('Sobran argumentos.');
  }

  if (bandera === undefined) return { email, plan, expiresAt: null };

  if (plan === 'FREE') throw falla('El plan gratis no vence: sin --hasta.');
  const m = fecha?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) throw falla('La fecha va como AAAA-MM-DD.');

  // Final del día indicado = medianoche del siguiente.
  const expiresAt = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3] + 1));
  if (Number.isNaN(expiresAt.getTime())) throw falla('La fecha no existe.');
  return { email, plan, expiresAt };
}
