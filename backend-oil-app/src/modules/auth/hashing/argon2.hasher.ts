// Argon2id: recomendación actual de OWASP. A diferencia de bcrypt es costoso en
// MEMORIA, no solo en CPU, que es lo que le quita la ventaja al atacante con GPU.
import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import type { PasswordHasher } from '../domain/password-hasher';

const OPCIONES: argon2.HashOptions = {
  type: argon2.argon2id,
  memoryCost: 19456, // 19 MiB — mínimo que recomienda OWASP
  timeCost: 2,
  parallelism: 1,
};

@Injectable()
export class Argon2Hasher implements PasswordHasher {
  hash(plain: string): Promise<string> {
    return argon2.hash(plain, OPCIONES);
  }

  async verify(hash: string, plain: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plain);
    } catch {
      // Hash corrupto o de otro formato: es un "no pasa", no una caída.
      return false;
    }
  }
}
