// Solo HTTP: recibe DTO, delega, responde. Cero reglas de negocio.
import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { User } from '../users/domain/user';
import {
  DEVICE_TOKEN_REPOSITORY,
  type DeviceTokenRepository,
} from './domain/device-token.repository';
import { RegisterDeviceDto } from './dto/register-device.dto';

@ApiTags('Notificaciones')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('me/devices')
export class DevicesController {
  constructor(
    @Inject(DEVICE_TOKEN_REPOSITORY)
    private readonly devices: DeviceTokenRepository,
  ) {}

  @ApiOperation({
    summary: 'Registrar el dispositivo para recibir notificaciones',
    description:
      'Idempotente: la app lo llama en cada arranque. Si el token ya existía con otro dueño, se reasigna — un token identifica una instalación, no una sesión.',
  })
  @ApiCreatedResponse({ description: 'El dispositivo quedó registrado.' })
  // La app lo llama en cada arranque, igual que refresh y me: es comportamiento
  // normal, no alguien adivinando credenciales.
  @SkipThrottle({ auth: true })
  @Post()
  async registrar(
    @CurrentUser() user: User,
    @Body() dto: RegisterDeviceDto,
  ): Promise<{ ok: true }> {
    await this.devices.registrar({
      userId: user.id,
      token: dto.token,
      platform: dto.platform,
    });
    return { ok: true };
  }

  @ApiOperation({
    summary: 'Dar de baja el dispositivo',
    description:
      'Se llama al cerrar sesión. Responde 204 aunque el token no exista.',
  })
  @ApiNoContentResponse()
  @SkipThrottle({ auth: true })
  @Delete(':token')
  @HttpCode(HttpStatus.NO_CONTENT)
  async eliminar(@Param('token') token: string): Promise<void> {
    await this.devices.eliminar(token);
  }
}
