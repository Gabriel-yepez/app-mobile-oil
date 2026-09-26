// Doble de test del almacén de refresh tokens: permite probar la rotación y la
// detección de reuso sin levantar base de datos.
import { randomUUID } from 'node:crypto';
import type {
  RefreshTokenRecord,
  RefreshTokenRepository,
} from '../domain/refresh-token.repository';

export class InMemoryRefreshTokenRepository implements RefreshTokenRepository {
  readonly records = new Map<string, RefreshTokenRecord>();

  create(data: {
    tokenHash: string;
    userId: string;
    expiresAt: Date;
  }): Promise<RefreshTokenRecord> {
    const record: RefreshTokenRecord = {
      ...data,
      id: randomUUID(),
      revokedAt: null,
      replacedBy: null,
    };
    this.records.set(record.id, record);
    return Promise.resolve(record);
  }

  findByHash(tokenHash: string): Promise<RefreshTokenRecord | null> {
    const found = [...this.records.values()].find(
      (r) => r.tokenHash === tokenHash,
    );
    return Promise.resolve(found ?? null);
  }

  markRotated(id: string, replacedById: string): Promise<void> {
    const r = this.records.get(id);
    if (r) {
      r.revokedAt = new Date();
      r.replacedBy = replacedById;
    }
    return Promise.resolve();
  }

  revokeByHash(tokenHash: string): Promise<void> {
    for (const r of this.records.values()) {
      if (r.tokenHash === tokenHash) r.revokedAt = new Date();
    }
    return Promise.resolve();
  }

  revokeAllForUser(userId: string): Promise<void> {
    for (const r of this.records.values()) {
      if (r.userId === userId && r.revokedAt === null) r.revokedAt = new Date();
    }
    return Promise.resolve();
  }
}
