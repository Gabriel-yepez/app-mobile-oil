import type {
  DeviceToken,
  DeviceTokenRepository,
  NuevoDeviceToken,
} from '../domain/device-token.repository';

export class InMemoryDeviceTokenRepository implements DeviceTokenRepository {
  readonly filas = new Map<string, DeviceToken>();
  private n = 0;

  async registrar(data: NuevoDeviceToken): Promise<DeviceToken> {
    const previo = this.filas.get(data.token);
    const fila: DeviceToken = {
      id: previo?.id ?? `dt-${++this.n}`,
      userId: data.userId,
      token: data.token,
      platform: data.platform,
      lastSeenAt: new Date(),
      disabledAt: null,
    };
    this.filas.set(data.token, fila);
    return fila;
  }

  async eliminar(userId: string, token: string): Promise<void> {
    if (this.filas.get(token)?.userId === userId) this.filas.delete(token);
  }

  async apagar(token: string): Promise<void> {
    const f = this.filas.get(token);
    if (f) this.filas.set(token, { ...f, disabledAt: new Date() });
  }

  async activosDe(userId: string): Promise<DeviceToken[]> {
    return [...this.filas.values()].filter(
      (f) => f.userId === userId && f.disabledAt === null,
    );
  }
}
