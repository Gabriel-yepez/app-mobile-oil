// Solo HTTP. El catálogo es una constante, así que no hay servicio que mediar:
// un servicio que devuelve un array literal es ceremonia, no diseño.
import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { COLORES } from './domain/vehicle-color';
import { ColorResponseDto } from './dto/color-response.dto';

@ApiTags('Colores')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('colors')
export class ColorsController {
  @ApiOperation({
    summary: 'Catálogo de colores de vehículo',
    description:
      'Lista fija, en el orden en que debe mostrarse. El vehículo guarda el `hex`, no una referencia: por eso quitar un color de acá no rompe ningún vehículo, solo deja su tono fuera del catálogo.',
  })
  @ApiOkResponse({ type: [ColorResponseDto] })
  @Get()
  list(): ColorResponseDto[] {
    return COLORES.map((c) => ({ name: c.name, hex: c.hex }));
  }
}
