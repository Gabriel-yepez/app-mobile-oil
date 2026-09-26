import {
  Body,
  Controller,
  Get,
  Inject,
  Patch,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { User } from '../users/domain/user';
import {
  NOTIFICATION_PREF_REPOSITORY,
  type NotificationPrefRepository,
} from './domain/notification-pref.repository';
import { PrefsResponseDto, toPrefsResponse } from './dto/prefs-response.dto';
import { UpdatePrefsDto } from './dto/update-prefs.dto';

@ApiTags('Notificaciones')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('me/notification-prefs')
export class NotificationPrefsController {
  constructor(
    @Inject(NOTIFICATION_PREF_REPOSITORY)
    private readonly prefs: NotificationPrefRepository,
  ) {}

  @ApiOperation({
    summary: 'Preferencias de notificación de la cuenta',
    description:
      'Quien nunca las tocó recibe los valores por defecto. Leerlas no crea la fila.',
  })
  @ApiOkResponse({ type: PrefsResponseDto })
  @SkipThrottle({ auth: true })
  @Get()
  async obtener(@CurrentUser() user: User): Promise<PrefsResponseDto> {
    return toPrefsResponse(await this.prefs.obtener(user.id));
  }

  @ApiOperation({
    summary: 'Cambiar las preferencias de notificación',
    description: 'Parcial: lo que no venga en el cuerpo no se toca.',
  })
  @ApiOkResponse({ type: PrefsResponseDto })
  @SkipThrottle({ auth: true })
  @Patch()
  async actualizar(
    @CurrentUser() user: User,
    @Body() dto: UpdatePrefsDto,
  ): Promise<PrefsResponseDto> {
    return toPrefsResponse(await this.prefs.guardar(user.id, dto));
  }
}
