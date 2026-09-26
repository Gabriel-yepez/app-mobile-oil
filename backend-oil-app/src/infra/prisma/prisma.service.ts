// Único punto del backend que conoce Prisma, junto con los repositorios.
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  // Prisma 7 exige un driver adapter: la URL ya no se declara en el schema.
  // Se toma del ConfigService y no de process.env para que sea el valor YA
  // validado por env.validation.ts — si falta, el proceso murió al arrancar.
  constructor(config: ConfigService) {
    super({
      adapter: new PrismaPg({
        connectionString: config.getOrThrow<string>('DATABASE_URL'),
      }),
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  // Sin esto, al apagar el proceso quedan conexiones colgadas y los tests e2e
  // no terminan nunca.
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
