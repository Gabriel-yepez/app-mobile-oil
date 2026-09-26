import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DolarApiTasaSource } from '../../infra/dolarapi/dolarapi-tasa.source';
import { TASA_SOURCE } from './domain/tasa-source';
import { ExchangeRateController } from './exchange-rate.controller';
import { ExchangeRateService } from './exchange-rate.service';

@Module({
  controllers: [ExchangeRateController],
  providers: [
    ExchangeRateService,
    {
      provide: TASA_SOURCE,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new DolarApiTasaSource(config.getOrThrow<string>('BCV_RATE_URL')),
    },
  ],
})
export class ExchangeRateModule {}
