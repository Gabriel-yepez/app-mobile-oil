// Configuración del CLI de Prisma 7. La URL sale del .env, que a su vez
// valida env.validation.ts al arrancar la aplicación.
import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: env('DATABASE_URL') },
});
