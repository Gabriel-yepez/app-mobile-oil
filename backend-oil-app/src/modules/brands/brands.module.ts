import { Module } from '@nestjs/common';
import { PrismaBrandRepository } from '../../infra/prisma/prisma-brand.repository';
import { BRAND_REPOSITORY } from './domain/brand.repository';
import { BrandsController } from './brands.controller';
import { BrandsService } from './brands.service';

@Module({
  controllers: [BrandsController],
  providers: [
    BrandsService,
    // Mismo criterio que OilModule: el servicio pide el token, nunca la clase.
    { provide: BRAND_REPOSITORY, useClass: PrismaBrandRepository },
  ],
})
export class BrandsModule {}
