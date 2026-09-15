// Doble de test: cumple el mismo contrato que el repositorio de Prisma, así que
// el negocio se testea entero sin levantar una base de datos.
//
// Vive en src/ y no en test/ a propósito: es código tipado que el compilador
// debe verificar contra la interfaz. Si el contrato cambia, esto rompe primero
// y el fallo sale en `tsc`, no en una ejecución de tests a medias.
import { randomUUID } from 'node:crypto';
import type { NewUser, User } from '../domain/user';
import type { UserRepository } from '../domain/user.repository';

export class InMemoryUserRepository implements UserRepository {
  private readonly users = new Map<string, User>();

  findById(id: string): Promise<User | null> {
    return Promise.resolve(this.users.get(id) ?? null);
  }

  findByEmail(email: string): Promise<User | null> {
    const found = [...this.users.values()].find((u) => u.email === email);
    return Promise.resolve(found ?? null);
  }

  existsByEmail(email: string): Promise<boolean> {
    return Promise.resolve(
      [...this.users.values()].some((u) => u.email === email),
    );
  }

  existsByCedula(cedula: string): Promise<boolean> {
    return Promise.resolve(
      [...this.users.values()].some((u) => u.cedula === cedula),
    );
  }

  create(data: NewUser): Promise<User> {
    const now = new Date();
    const user: User = {
      ...data,
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    this.users.set(user.id, user);
    return Promise.resolve(user);
  }
}
