import { Controller, Get, HttpStatus, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ApiErrorResponse } from '../../common/swagger/api-error-response.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ExchangeRateResponseDto } from './dto/exchange-rate-response.dto';
import { ExchangeRateService } from './exchange-rate.service';

@ApiTags('Tasa de cambio')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('exchange-rate')
export class ExchangeRateController {
  constructor(private readonly rates: ExchangeRateService) {}

  @ApiOperation({
    summary: 'Tasa oficial del BCV (Bs. por USD)',
    description:
      'Se consulta al proveedor como mucho cada 30 minutos. Si el proveedor falla, se devuelve la última tasa conocida; solo es 503 si el servidor nunca obtuvo una.',
  })
  @ApiOkResponse({ type: ExchangeRateResponseDto })
  @ApiErrorResponse(
    HttpStatus.SERVICE_UNAVAILABLE,
    'El proveedor no contestó y no hay tasa guardada.',
    {
      sinTasa: {
        resumen: 'el proveedor está caído y el servidor recién arrancó',
        error: 'EXCHANGE_RATE_UNAVAILABLE',
        message: 'La tasa del BCV no está disponible en este momento.',
      },
    },
  )
  @Get('bcv')
  async bcv(): Promise<ExchangeRateResponseDto> {
    const t = await this.rates.bcv();
    return {
      bsPerUsd: t.bsPorUsd,
      effectiveDate: t.vigente.toISOString(),
      fetchedAt: t.consultada.toISOString(),
    };
  }
}
