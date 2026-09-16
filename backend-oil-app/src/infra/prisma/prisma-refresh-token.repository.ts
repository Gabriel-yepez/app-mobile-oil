// Frontera con Prisma para los refresh tokens. Mismo contrato que el doble en
// memoria: el TokenService no distingue cuál tiene delante.
import { Injectable } from '@nestjs/common';
import type { RefreshToken as PrismaRefreshToken } from '@prisma/client';
import type {
  RefreshTokenRecord,
  RefreshTokenRepository,
} from '../../modules/auth/domain/refresh-token.repository';
import { PrismaService } from './prisma.service';

@Injectable()
export class PrismaRefreshTokenRepository implements RefreshTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toDomain(row: PrismaRefreshToken): RefreshTokenRecord {
    return {
      id: row.id,
      tokenHash: row.tokenHash,
      userId: row.userId,
      expiresAt: row.expiresAt,
      revokedAt: row.revokedAt,
      replacedBy: row.replacedBy,
    };
  }

  async create(data: {
    tokenHash: string;
    userId: string;
    expiresAt: Date;
  }): Promise<RefreshTokenRecord> {
    return this.toDomain(await this.prisma.refreshToken.create({ data }));
  }

  async findByHash(tokenHash: string): Promise<RefreshTokenRecord | null> {
    const row = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });
    return row ? this.toDomain(row) : null;
  }

  async markRotated(id: string, replacedById: string): Promise<void> {
    await this.prisma.refreshToken.update({
      where: { id },
      data: { revokedAt: new Date(), replacedBy: replacedById },
    });
  }

  async revokeByHash(tokenHash: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
