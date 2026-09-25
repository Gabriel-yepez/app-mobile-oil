import { Injectable } from '@nestjs/common';
import type { PasswordResetCode } from '@prisma/client';
import type {
  PasswordResetRepository,
  ResetRecord,
} from '../../modules/auth/domain/password-reset.repository';
import { PrismaService } from './prisma.service';

@Injectable()
export class PrismaPasswordResetRepository implements PasswordResetRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toDomain(r: PasswordResetCode): ResetRecord {
    return {
      id: r.id,
      userId: r.userId,
      codeHash: r.codeHash,
      expiresAt: r.expiresAt,
      attempts: r.attempts,
      resetTokenHash: r.resetTokenHash,
      resetExpiresAt: r.resetExpiresAt,
      usedAt: r.usedAt,
    };
  }

  async reemplazarCodigo(datos: {
    userId: string;
    codeHash: string;
    expiresAt: Date;
  }): Promise<ResetRecord> {
    // En una transacción: invalidar los viejos y crear el nuevo tienen que ir
    // juntos, o una caída entre ambos dejaría al usuario con dos códigos
    // válidos a la vez.
    const [, creado] = await this.prisma.$transaction([
      this.prisma.passwordResetCode.updateMany({
        where: { userId: datos.userId, usedAt: null },
        data: { usedAt: new Date() },
      }),
      this.prisma.passwordResetCode.create({ data: datos }),
    ]);
    return this.toDomain(creado);
  }

  async vigenteDe(userId: string): Promise<ResetRecord | null> {
    const r = await this.prisma.passwordResetCode.findFirst({
      where: { userId, usedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    return r ? this.toDomain(r) : null;
  }

  async sumarIntento(id: string): Promise<number> {
    // Incremento en la base, no leer-sumar-escribir: dos intentos simultáneos
    // tienen que contar como dos, o el tope se esquiva disparando en paralelo.
    const r = await this.prisma.passwordResetCode.update({
      where: { id },
      data: { attempts: { increment: 1 } },
    });
    return r.attempts;
  }

  async marcarVerificado(
    id: string,
    token: { resetTokenHash: string; resetExpiresAt: Date },
  ): Promise<void> {
    await this.prisma.passwordResetCode.update({ where: { id }, data: token });
  }

  async porResetToken(resetTokenHash: string): Promise<ResetRecord | null> {
    const r = await this.prisma.passwordResetCode.findUnique({
      where: { resetTokenHash },
    });
    return r ? this.toDomain(r) : null;
  }

  async consumir(id: string): Promise<boolean> {
    // updateMany con `usedAt: null` en el WHERE es la operación atómica: la
    // base solo deja que UNA de dos peticiones simultáneas encuentre la fila
    // sin usar. La otra actualiza cero filas y pierde.
    const { count } = await this.prisma.passwordResetCode.updateMany({
      where: { id, usedAt: null },
      data: { usedAt: new Date() },
    });
    return count === 1;
  }
}
