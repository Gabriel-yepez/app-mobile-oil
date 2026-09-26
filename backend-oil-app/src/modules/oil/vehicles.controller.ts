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
  Query,
  Patch,
  Post,
  Put,
  Res,
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
import type { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { User } from '../users/domain/user';
import {
  CreateOilChangeDto,
  UpdateOilChangeDto,
} from './dto/create-oil-change.dto';
import { CreateOdometerReadingDto } from './dto/create-odometer-reading.dto';
import {
  ListOilChangesQueryDto,
  OilChangePageDto,
} from './dto/oil-change-response.dto';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { SnoozeAlertDto } from './dto/snooze-alert.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { OilStatusResponseDto } from './dto/oil-status-response.dto';
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

  @ApiOperation({
    summary: 'Listar los vehículos del usuario',
    description:
      'Cada vehículo viene con su `gauge` y su `odometer` ya calculados, para que la pantalla de la flota sea una sola llamada.',
  })
  @ApiOkResponse({ type: [VehicleResponseDto] })
  @Get()
  async list(@CurrentUser() user: User): Promise<VehicleResponseDto[]> {
    return this.oil.listVehiclesWithStatus(user.id);
  }

  @ApiOperation({
    summary: 'Dar de alta un vehículo',
    description: [
      'El `kmPerDay` declarado es lo que arranca la estimación del odómetro',
      'mientras no haya dos cambios de aceite que medir.',
    ].join(' '),
  })
  @ApiCreatedResponse({ type: VehicleResponseDto })
  @ApiOkResponse({
    type: VehicleResponseDto,
    description:
      'El `id` ya existía: se devuelve el registro tal cual, sin duplicar. Es un reintento de la cola, no un error.',
  })
  @Post()
  async create(
    @CurrentUser() user: User,
    @Body() dto: CreateVehicleDto,
    // passthrough: Nest sigue serializando el retorno; acá solo se ajusta el
    // código, que es 201 por defecto en @Post.
    @Res({ passthrough: true }) res: Response,
  ): Promise<VehicleResponseDto> {
    const { vehicle, created } = await this.oil.createVehicleIdempotent(
      user.id,
      dto,
    );
    res.status(created ? HttpStatus.CREATED : HttpStatus.OK);
    return toVehicleResponse(vehicle);
  }

  @ApiOperation({
    summary: 'Editar la ficha de un vehículo',
    description: [
      'No toca el ciclo ni el historial: eso se cambia registrando o',
      'corrigiendo un cambio de aceite. Si se manda `kmPerDay`, la fuente',
      'vuelve a `DECLARED` — el usuario está pisando lo medido a propósito, y',
      'el próximo ciclo medido lo recalibra solo.',
    ].join(' '),
  })
  @ApiOkResponse({ type: VehicleResponseDto })
  @Patch(':id')
  async update(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateVehicleDto,
  ): Promise<VehicleResponseDto> {
    return toVehicleResponse(await this.oil.updateVehicle(user.id, id, dto));
  }

  @ApiOperation({
    summary: 'Borrar un vehículo',
    description:
      'Se lleva con él su historial y sus lecturas de odómetro. No se puede deshacer.',
  })
  @ApiNoContentResponse()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  async remove(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.oil.removeVehicle(user.id, id);
  }

  @ApiOperation({
    summary: 'Posponer la alerta del aceite',
    description: [
      'Calla la alerta del vehículo por `days` días: deja de contarse como',
      'abierta y no se mandan push. Pedirlo de nuevo reemplaza el plazo, no lo',
      'suma. Registrar un cambio de aceite la reactiva sola.',
    ].join(' '),
  })
  @ApiOkResponse({ type: VehicleResponseDto })
  @Put(':id/alert-snooze')
  async snoozeAlert(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SnoozeAlertDto,
  ): Promise<VehicleResponseDto> {
    return this.oil.snoozeAlert(user.id, id, dto.days);
  }

  @ApiOperation({
    summary: 'Reactivar la alerta pospuesta',
    description:
      'Deshace el posponer antes de que venza. Si no estaba pospuesta, no hace nada.',
  })
  @ApiOkResponse({ type: VehicleResponseDto })
  @Delete(':id/alert-snooze')
  async unsnoozeAlert(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<VehicleResponseDto> {
    return this.oil.unsnoozeAlert(user.id, id);
  }

  @ApiOperation({
    summary: 'Estado del aceite del vehículo',
    description: [
      'Devuelve el bloque completo del inicio en una sola llamada: medidor,',
      'odómetro (real o estimado), ciclo vigente y aceite montado.',
      '',
      'El odómetro se **proyecta** desde la última lectura real con el ritmo de',
      'km/día del vehículo cuando no hay una lectura de hoy — porque el',
      'odómetro solo existe sentado en el auto y entre cambio y cambio nadie lo',
      'reporta. `odometer.source` dice cuál de los dos casos es.',
      '',
      'La vida del aceite corre por dos ejes, km y tiempo, y vale el peor:',
      'el "5.000 km o 6 meses, lo que ocurra primero" del manual.',
      '`gauge.limitedBy` dice cuál de los dos manda.',
    ].join('\n'),
  })
  @ApiOkResponse({ type: OilStatusResponseDto })
  @Get(':id/oil-status')
  async oilStatus(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<OilStatusResponseDto> {
    return this.oil.getOilStatus(user.id, id);
  }

  @ApiOperation({
    summary: 'Reportar una lectura del odómetro',
    description: [
      'Reancla la estimación a la realidad y devuelve el bloque de estado ya',
      'recalculado, así la app no necesita una segunda llamada.',
    ].join(' '),
  })
  @ApiCreatedResponse({ type: OilStatusResponseDto })
  @Post(':id/odometer')
  async reportOdometer(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateOdometerReadingDto,
  ): Promise<OilStatusResponseDto> {
    return this.oil.reportOdometer(user.id, id, dto.km);
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
  @ApiOkResponse({
    description:
      'El `id` ya existía: se devuelve el cambio tal cual. Es un reintento de la cola, no un ciclo nuevo.',
  })
  @Post(':id/oil-changes')
  async registerChange(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateOilChangeDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { change, created } = await this.oil.registerOilChangeIdempotent(
      user.id,
      id,
      { ...dto, shop: dto.shop ?? null, costUsd: dto.costUsd ?? null },
    );
    res.status(created ? HttpStatus.CREATED : HttpStatus.OK);
    return change;
  }

  @ApiOperation({
    summary: 'Historial de cambios del vehículo',
    description:
      'Del más nuevo al más viejo, paginado por cursor. `nextCursor` en `null` significa que no hay más páginas.',
  })
  @ApiOkResponse({ type: OilChangePageDto })
  @Get(':id/oil-changes')
  async listChanges(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ListOilChangesQueryDto,
  ): Promise<OilChangePageDto> {
    return this.oil.listOilChanges(user.id, id, query);
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
