// El token de dispositivo como lo entiende el negocio. Sin tipos de Prisma.
export const DEVICE_TOKEN_REPOSITORY = Symbol('DEVICE_TOKEN_REPOSITORY');

export type DevicePlatform = 'IOS' | 'ANDROID';

export type DeviceToken = {
  id: string;
  userId: string;
  token: string;
  platform: DevicePlatform;
  lastSeenAt: Date;
  disabledAt: Date | null;
};

export type NuevoDeviceToken = {
  userId: string;
  token: string;
  platform: DevicePlatform;
};

export interface DeviceTokenRepository {
  /**
   * Upsert POR TOKEN, no por (usuario, token). Si la fila ya existe con otro
   * dueño, se reasigna: un token identifica una instalación, y el dueño
   * anterior no puede seguir recibiendo avisos en un teléfono ajeno.
   * Revive el token apagado poniendo `disabledAt` en null.
   */
  registrar(data: NuevoDeviceToken): Promise<DeviceToken>;
  /**
   * Baja explícita al cerrar sesión. No falla si no existe.
   *
   * Lleva `userId` y no solo el token: sin él, cualquier sesión válida podría
   * dar de baja el dispositivo de otro y dejarlo sin avisos con solo conocer
   * su token. El token identifica la instalación, no autoriza nada.
   */
  eliminar(userId: string, token: string): Promise<void>;
  /** Lo que hace `DeviceNotRegistered`: apaga sin perder el historial. */
  apagar(token: string): Promise<void>;
  /** Solo los que no están apagados. */
  activosDe(userId: string): Promise<DeviceToken[]>;
}
