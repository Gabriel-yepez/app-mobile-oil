import { Module } from '@nestjs/common';
import { PrismaShopRepository } from '../../infra/prisma/prisma-shop.repository';
import { SHOP_REPOSITORY } from './domain/shop.repository';
import { ShopsController } from './shops.controller';
import { ShopsService } from './shops.service';

@Module({
  controllers: [ShopsController],
  providers: [
    ShopsService,
    // Mismo criterio que BrandsModule: el servicio pide el token, nunca la clase.
    { provide: SHOP_REPOSITORY, useClass: PrismaShopRepository },
  ],
})
export class ShopsModule {}
