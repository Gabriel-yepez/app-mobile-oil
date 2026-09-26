// Solo HTTP. Los planes y la suscripción del usuario; cambiar de plan espera
// a los pagos, así que acá no hay ninguna ruta que escriba.
import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { User } from '../users/domain/user';
import { LISTA_PLANES } from './domain/plans';
import {
  PlanResponseDto,
  SubscriptionResponseDto,
  toPlanResponse,
  toSubscriptionResponse,
} from './dto/subscription-response.dto';
import { SubscriptionsService } from './subscriptions.service';

@ApiTags('Planes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class SubscriptionsController {
  constructor(private readonly subs: SubscriptionsService) {}

  @ApiOperation({
    summary: 'Catálogo de planes',
    description:
      'Los dos planes, el gratis primero. Los topes que trae cada uno son los mismos que aplica el servidor.',
  })
  @ApiOkResponse({ type: [PlanResponseDto] })
  @Get('plans')
  list(): PlanResponseDto[] {
    return LISTA_PLANES.map(toPlanResponse);
  }

  @ApiOperation({
    summary: 'Mi suscripción y lo que llevo consumido',
    description:
      'El plan que rige hoy y el uso contra sus topes: vehículos y cambios con fecha en el mes en curso.',
  })
  @ApiOkResponse({ type: SubscriptionResponseDto })
  @Get('me/subscription')
  async mine(@CurrentUser() user: User): Promise<SubscriptionResponseDto> {
    return toSubscriptionResponse(await this.subs.estado(user.id));
  }
}
