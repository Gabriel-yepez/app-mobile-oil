// Solo HTTP: recibe DTO, delega, devuelve DTO. Cero reglas de negocio.
import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { User } from '../users/domain/user';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import {
  toVehicleResponse,
  VehicleResponseDto,
} from './dto/vehicle-response.dto';
import { OilService } from './oil.service';

@ApiTags('Vehículos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('vehicles')
export class VehiclesController {
  constructor(private readonly oil: OilService) {}

  @ApiOperation({ summary: 'Listar los vehículos del usuario' })
  @ApiOkResponse({ type: [VehicleResponseDto] })
  @Get()
  async list(@CurrentUser() user: User): Promise<VehicleResponseDto[]> {
    const vehicles = await this.oil.listVehicles(user.id);
    return vehicles.map(toVehicleResponse);
  }

  @ApiOperation({
    summary: 'Dar de alta un vehículo',
    description: [
      'El `kmPerDay` declarado es lo que arranca la estimación del odómetro',
      'mientras no haya dos cambios de aceite que medir.',
    ].join(' '),
  })
  @ApiCreatedResponse({ type: VehicleResponseDto })
  @Post()
  async create(
    @CurrentUser() user: User,
    @Body() dto: CreateVehicleDto,
  ): Promise<VehicleResponseDto> {
    return toVehicleResponse(await this.oil.createVehicle(user.id, dto));
  }
}
