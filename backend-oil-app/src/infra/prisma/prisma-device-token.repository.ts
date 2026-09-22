// Frontera con Prisma. Entra y sale el tipo de DOMINIO.
import { Injectable } from '@nestjs/common';
import type { DeviceToken as Row } from '@prisma/client';
import type {
  DeviceToken,
  DeviceTokenRepository,
  NuevoDeviceToken,
} from '../../modules/notifications/domain/device-token.repository';
import { PrismaService } from './prisma.service';

@Injectable()
export class PrismaDeviceTokenRepository implements DeviceTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toDomain(r: Row): DeviceToken {
    return {
      id: r.id,
      userId: r.userId,
      token: r.token,
      platform: r.platform,
      lastSeenAt: r.lastSeenAt,
      disabledAt: r.disabledAt,
    };
  }

  async registrar(data: NuevoDeviceToken): Promise<DeviceToken> {
    // El `update` reasigna userId a propósito: ver el comentario del puerto.
    const row = await this.prisma.deviceToken.upsert({
      where: { token: data.token },
      create: {
        userId: data.userId,
        token: data.token,
        platform: data.platform,
      },
      update: {
        userId: data.userId,
        platform: data.platform,
        lastSeenAt: new Date(),
        disabledAt: null,
      },
    });
    return this.toDomain(row);
  }

  async eliminar(userId: string, token: string): Promise<void> {
    // El userId en el where es lo que impide dar de baja el dispositivo
    // ajeno. `deleteMany` no falla si no hay fila, así que la respuesta sigue
    // siendo 204 y no delata si ese token existe o de quién es.
    await this.prisma.deviceToken.deleteMany({ where: { token, userId } });
  }

  async apagar(token: string): Promise<void> {
    await this.prisma.deviceToken.updateMany({
      where: { token },
      data: { disabledAt: new Date() },
    });
  }

  async activosDe(userId: string): Promise<DeviceToken[]> {
    const rows = await this.prisma.deviceToken.findMany({
      where: { userId, disabledAt: null },
    });
    return rows.map((r) => this.toDomain(r));
  }
}
