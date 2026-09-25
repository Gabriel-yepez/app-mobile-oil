import { randomUUID } from 'node:crypto';
import type {
  PasswordResetRepository,
  ResetRecord,
} from '../domain/password-reset.repository';

export class InMemoryPasswordResetRepository implements PasswordResetRepository {
  readonly records = new Map<string, ResetRecord>();

  reemplazarCodigo(datos: {
    userId: string;
    codeHash: string;
    expiresAt: Date;
  }): Promise<ResetRecord> {
    for (const r of this.records.values()) {
      if (r.userId === datos.userId && !r.usedAt) r.usedAt = new Date();
    }
    const nuevo: ResetRecord = {
      ...datos,
      id: randomUUID(),
      attempts: 0,
      resetTokenHash: null,
      resetExpiresAt: null,
      usedAt: null,
    };
    this.records.set(nuevo.id, nuevo);
    return Promise.resolve(nuevo);
  }

  vigenteDe(userId: string): Promise<ResetRecord | null> {
    const vigentes = [...this.records.values()].filter(
      (r) => r.userId === userId && !r.usedAt,
    );
    return Promise.resolve(vigentes.at(-1) ?? null);
  }

  sumarIntento(id: string): Promise<number> {
    const r = this.records.get(id);
    if (!r) throw new Error(`No existe el intento ${id}`);
    r.attempts += 1;
    return Promise.resolve(r.attempts);
  }

  marcarVerificado(
    id: string,
    token: { resetTokenHash: string; resetExpiresAt: Date },
  ): Promise<void> {
    const r = this.records.get(id);
    if (!r) throw new Error(`No existe el intento ${id}`);
    Object.assign(r, token);
    return Promise.resolve();
  }

  porResetToken(resetTokenHash: string): Promise<ResetRecord | null> {
    const r = [...this.records.values()].find(
      (x) => x.resetTokenHash === resetTokenHash,
    );
    return Promise.resolve(r ?? null);
  }

  consumir(id: string): Promise<boolean> {
    const r = this.records.get(id);
    if (!r || r.usedAt) return Promise.resolve(false);
    r.usedAt = new Date();
    return Promise.resolve(true);
  }
}
