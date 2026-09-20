// Frontera con Prisma. Entra y sale el tipo de DOMINIO: el mapeo se hace acá y
// no más arriba, que es lo que mantiene a los servicios ignorantes del motor.
import { Injectable } from '@nestjs/common';
import type { User as PrismaUser } from '@prisma/client';
import type { NewUser, User } from '../../modules/users/domain/user';
import type {
  UserProfilePatch,
  UserRepository,
} from '../../modules/users/domain/user.repository';
import { PrismaService } from './prisma.service';

@Injectable()
export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toDomain(row: PrismaUser): User {
    return {
      id: row.id,
      email: row.email,
      cedula: row.cedula,
      passwordHash: row.passwordHash,
      fullName: row.fullName,
      phone: row.phone,
      state: row.state,
      city: row.city,
      currency: row.currency,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async findById(id: string): Promise<User | null> {
    const row = await this.prisma.user.findUnique({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const row = await this.prisma.user.findUnique({ where: { email } });
    return row ? this.toDomain(row) : null;
  }

  async existsByEmail(email: string): Promise<boolean> {
    return (await this.prisma.user.count({ where: { email } })) > 0;
  }

  async existsByCedula(cedula: string): Promise<boolean> {
    return (await this.prisma.user.count({ where: { cedula } })) > 0;
  }

  async create(data: NewUser): Promise<User> {
    return this.toDomain(await this.prisma.user.create({ data }));
  }

  // `data` recibe el patch tal cual: Prisma solo escribe las claves presentes,
  // así que las que el usuario no tocó ni se mencionan en el UPDATE. El
  // `updatedAt` lo mueve el @updatedAt del esquema.
  async update(id: string, patch: UserProfilePatch): Promise<User> {
    return this.toDomain(
      await this.prisma.user.update({ where: { id }, data: patch }),
    );
  }
}
