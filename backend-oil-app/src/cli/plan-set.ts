// `pnpm plan:set <correo> <FREE|PRO> [--hasta AAAA-MM-DD]`
//
// Cambia el plan de un usuario a mano. Existe mientras no haya pagos: es la
// forma de dar el Pro sin escribir SQL, que es fácil de equivocar (un id mal
// copiado, un updatedAt olvidado) y no deja rastro de qué se hizo.
//
// No levanta Nest: con el AppModule arrancarían los cron de push y el resto
// de la app para escribir una fila.
import 'dotenv/config';
// Nest lo carga solo al arrancar; acá no hay Nest, y validateEnv usa los
// decoradores de class-validator, que sin esto fallan.
import 'reflect-metadata';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { validateEnv } from '../config/env.validation';
import { parsearArgs } from './plan-set.args';

async function main(): Promise<void> {
  const args = parsearArgs(process.argv.slice(2));
  // El mismo validador que el servidor: si el entorno está mal, se sabe acá
  // y no con un error críptico de conexión.
  const env = validateEnv(process.env);
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
  });

  try {
    const user = await prisma.user.findUnique({
      where: { email: args.email },
      select: { id: true, fullName: true },
    });
    if (!user)
      throw new Error(`No hay ningún usuario con el correo ${args.email}.`);

    await prisma.subscription.upsert({
      where: { userId: user.id },
      create: { userId: user.id, plan: args.plan, expiresAt: args.expiresAt },
      update: { plan: args.plan, expiresAt: args.expiresAt },
    });

    // expiresAt es la medianoche SIGUIENTE; se muestra el último día incluido.
    const ultimoDia = args.expiresAt
      ? new Date(args.expiresAt.getTime() - 1).toISOString().slice(0, 10)
      : null;
    const vence = ultimoDia
      ? `hasta el ${ultimoDia} inclusive`
      : 'sin vencimiento';
    console.log(`${user.fullName} <${args.email}> → ${args.plan}, ${vence}.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
