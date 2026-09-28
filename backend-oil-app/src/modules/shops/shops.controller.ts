// Solo HTTP: recibe DTO, delega, devuelve DTO. Cero reglas de negocio.
import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { User } from '../users/domain/user';
import { ShopsService } from './shops.service';
import {
  CreateShopDto,
  CreateShopResponseDto,
  ShopResponseDto,
  toCreateShopResponse,
  toShopResponse,
} from './dto/shop.dto';

@ApiTags('Talleres')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('shops')
export class ShopsController {
  constructor(private readonly shops: ShopsService) {}

  @ApiOperation({
    summary: 'Catálogo de talleres y lubricentros',
    description:
      'Incluye las semillas y todo lo que aportaron los usuarios. El catálogo es común: lo que agrega uno lo ven todos.',
  })
  @ApiOkResponse({ type: [ShopResponseDto] })
  @Get()
  async list(): Promise<ShopResponseDto[]> {
    const talleres = await this.shops.list();
    return talleres.map(toShopResponse);
  }

  @ApiOperation({
    summary: 'Agregar un taller al catálogo común',
    description:
      'Queda visible para todos los usuarios de inmediato. Si el nombre ya existe (comparando normalizado), devuelve el que estaba sin crear nada.',
  })
  @ApiCreatedResponse({ type: CreateShopResponseDto })
  @ApiOkResponse({
    type: CreateShopResponseDto,
    description:
      'El taller ya existía, por nombre o por id. Se devuelve el guardado; no es un error.',
  })
  @Post()
  async create(
    @CurrentUser() user: User,
    @Body() dto: CreateShopDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<CreateShopResponseDto> {
    const { shop, created } = await this.shops.create(user.id, dto);
    res.status(created ? HttpStatus.CREATED : HttpStatus.OK);
    return toCreateShopResponse(shop, created);
  }
}
