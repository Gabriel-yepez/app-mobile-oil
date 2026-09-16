export const REFRESH_TOKEN_REPOSITORY = Symbol('REFRESH_TOKEN_REPOSITORY');

export type RefreshTokenRecord = {
  id: string;
  tokenHash: string;
  userId: string;
  expiresAt: Date;
  revokedAt: Date | null;
  replacedBy: string | null;
};

export interface RefreshTokenRepository {
  create(data: {
    tokenHash: string;
    userId: string;
    expiresAt: Date;
  }): Promise<RefreshTokenRecord>;
  findByHash(tokenHash: string): Promise<RefreshTokenRecord | null>;
  /** Marca el token como rotado, apuntando al que lo sucede. */
  markRotated(id: string, replacedById: string): Promise<void>;
  revokeByHash(tokenHash: string): Promise<void>;
  /** Respuesta ante reuso detectado: se caen todas las sesiones del usuario. */
  revokeAllForUser(userId: string): Promise<void>;
}
