// Solo HTTP: recibe DTO, delega, devuelve DTO. Cero reglas de negocio.
import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Post,
  Query,
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
import { BrandsService } from './brands.service';
import { CreateBrandDto, ListBrandsQueryDto } from './dto/create-brand.dto';
import {
  BrandResponseDto,
  CreateBrandResponseDto,
  toBrandResponse,
  toCreateBrandResponse,
} from './dto/brand-response.dto';

@ApiTags('Marcas')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('brands')
export class BrandsController {
  constructor(private readonly brands: BrandsService) {}

  @ApiOperation({
    summary: 'Catálogo de marcas de un tipo de vehículo',
    description:
      'Incluye las semillas y todo lo que aportaron los usuarios. El catálogo es común: lo que agrega uno lo ven todos.',
  })
  @ApiOkResponse({ type: [BrandResponseDto] })
  @Get()
  async list(@Query() q: ListBrandsQueryDto): Promise<BrandResponseDto[]> {
    const marcas = await this.brands.list(q.kind);
    return marcas.map(toBrandResponse);
  }

  @ApiOperation({
    summary: 'Agregar una marca al catálogo común',
    description:
      'Queda visible para todos los usuarios de inmediato. Si el nombre ya existe (comparando normalizado), devuelve la que estaba sin crear nada.',
  })
  @ApiCreatedResponse({ type: CreateBrandResponseDto })
  @ApiOkResponse({
    type: CreateBrandResponseDto,
    description:
      'La marca ya existía, por nombre o por id. Se devuelve la guardada; no es un error.',
  })
  @Post()
  async create(
    @CurrentUser() user: User,
    @Body() dto: CreateBrandDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<CreateBrandResponseDto> {
    const { brand, created } = await this.brands.create(user.id, dto);
    res.status(created ? HttpStatus.CREATED : HttpStatus.OK);
    return toCreateBrandResponse(brand, created);
  }
}
