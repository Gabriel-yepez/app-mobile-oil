import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { TokenService } from './token.service';
import { InMemoryRefreshTokenRepository } from './testing/in-memory-refresh-token.repository';
import type { User } from '../users/domain/user';

const usuario: User = {
  id: '11111111-1111-1111-1111-111111111111',
  email: 'luis@correo.com',
  cedula: 'V25481073',
  passwordHash: 'hash',
  fullName: 'Luis Guerrero',
  phone: '+58 414 528 9012',
  state: null,
  city: null,
  currency: 'BOTH',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const config = new ConfigService({
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
  JWT_ACCESS_TTL: '15m',
  JWT_REFRESH_TTL: '30d',
});

describe('TokenService', () => {
  let repo: InMemoryRefreshTokenRepository;
  let service: TokenService;

  beforeEach(() => {
    repo = new InMemoryRefreshTokenRepository();
    service = new TokenService(new JwtService({}), config, repo);
  });

  it('emite un par y guarda el refresh HASHEADO, nunca en claro', async () => {
    const { accessToken, refreshToken } = await service.issuePair(usuario);

    expect(accessToken.split('.')).toHaveLength(3);
    const guardados = [...repo.records.values()];
    expect(guardados).toHaveLength(1);
    // Lo que importa: un volcado de la base no entrega sesiones vivas.
    expect(guardados[0].tokenHash).not.toBe(refreshToken);
    expect(guardados[0].userId).toBe(usuario.id);
  });

  it('el access token lleva el id del usuario', async () => {
    const { accessToken } = await service.issuePair(usuario);
    const payload = JSON.parse(
      Buffer.from(accessToken.split('.')[1], 'base64').toString(),
    ) as { sub: string };
    expect(payload.sub).toBe(usuario.id);
  });

  it('rota: devuelve un par nuevo y revoca el anterior', async () => {
    const primero = await service.issuePair(usuario);
    const { pair, userId } = await service.rotate(primero.refreshToken);

    expect(userId).toBe(usuario.id);
    expect(pair.refreshToken).not.toBe(primero.refreshToken);

    const viejo = [...repo.records.values()].find((r) => r.replacedBy !== null);
    expect(viejo?.revokedAt).toBeInstanceOf(Date);
  });

  it('rechaza un refresh token desconocido', async () => {
    await expect(service.rotate('token-inventado')).rejects.toThrow();
  });

  // EL caso que justifica la rotación: si un token ya rotado vuelve a aparecer,
  // hay dos copias circulando → alguien lo robó.
  it('ante reuso de un token ya rotado, revoca TODAS las sesiones', async () => {
    const primero = await service.issuePair(usuario);
    const segundo = await service.issuePair(usuario); // otro dispositivo
    await service.rotate(primero.refreshToken);

    await expect(service.rotate(primero.refreshToken)).rejects.toThrow();

    // La sesión del otro dispositivo también cae: no sabemos cuál fue robada.
    const vivos = [...repo.records.values()].filter(
      (r) => r.revokedAt === null,
    );
    expect(vivos).toHaveLength(0);
    await expect(service.rotate(segundo.refreshToken)).rejects.toThrow();
  });

  it('revoca en el cierre de sesión', async () => {
    const { refreshToken } = await service.issuePair(usuario);
    await service.revoke(refreshToken);
    await expect(service.rotate(refreshToken)).rejects.toThrow();
  });
});
