// Solo HTTP: recibe DTO, delega, devuelve DTO. Cero reglas de negocio.
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { User } from '../users/domain/user';
import {
  CreateOilChangeDto,
  UpdateOilChangeDto,
} from './dto/create-oil-change.dto';
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

  @ApiOperation({
    summary: 'Registrar un cambio de aceite',
    description: [
      'Abre un ciclo nuevo y, con él, escribe una lectura de odómetro: el km',
      'del cambio es una medición real y pasa a ser la base desde la que se',
      'proyecta el odómetro hasta la próxima lectura.',
    ].join(' '),
  })
  @ApiCreatedResponse({ description: 'El cambio registrado.' })
  @Post(':id/oil-changes')
  async registerChange(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateOilChangeDto,
  ) {
    return this.oil.registerOilChange(user.id, id, {
      ...dto,
      shop: dto.shop ?? null,
      costUsd: dto.costUsd ?? null,
    });
  }

  @ApiOperation({
    summary: 'Corregir un cambio de aceite',
    description:
      'Si el cambio corregido es el vigente, el ciclo del vehículo se recalcula solo.',
  })
  @ApiOkResponse({ description: 'El cambio ya corregido.' })
  @Patch('oil-changes/:changeId')
  async updateChange(
    @CurrentUser() user: User,
    @Param('changeId', ParseUUIDPipe) changeId: string,
    @Body() dto: UpdateOilChangeDto,
  ) {
    return this.oil.updateOilChange(user.id, changeId, dto);
  }

  @ApiOperation({
    summary: 'Borrar un cambio de aceite',
    description:
      'Si era el vigente, el ciclo del vehículo retrocede al cambio anterior.',
  })
  @ApiNoContentResponse()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('oil-changes/:changeId')
  async removeChange(
    @CurrentUser() user: User,
    @Param('changeId', ParseUUIDPipe) changeId: string,
  ): Promise<void> {
    await this.oil.removeOilChange(user.id, changeId);
  }
}
