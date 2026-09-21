import { Module } from '@nestjs/common';
import { PrismaOilChangeRepository } from '../../infra/prisma/prisma-oil-change.repository';
import { PrismaOdometerRepository } from '../../infra/prisma/prisma-odometer.repository';
import { PrismaVehicleRepository } from '../../infra/prisma/prisma-vehicle.repository';
import { OIL_CHANGE_REPOSITORY } from './domain/oil-change.repository';
import { ODOMETER_REPOSITORY } from './domain/odometer.repository';
import { VEHICLE_REPOSITORY } from './domain/vehicle.repository';
import { OilCycleService } from './oil-cycle.service';
import { OilService } from './oil.service';
import { VehiclesController } from './vehicles.controller';

@Module({
  controllers: [VehiclesController],
  providers: [
    OilService,
    OilCycleService,
    // ───────────────────────────────────────────────────────────────────
    // Mismo criterio que UsersModule: los servicios piden el token, nunca la
    // clase concreta. Cambiar de motor es cambiar estos tres useClass.
    { provide: VEHICLE_REPOSITORY, useClass: PrismaVehicleRepository },
    { provide: OIL_CHANGE_REPOSITORY, useClass: PrismaOilChangeRepository },
    { provide: ODOMETER_REPOSITORY, useClass: PrismaOdometerRepository },
    // ───────────────────────────────────────────────────────────────────
  ],
  // Los exporta para el barrido de push, que recorre los vehículos de todos
  // los usuarios y necesita leer ciclo y odómetro por su cuenta.
  exports: [VEHICLE_REPOSITORY, OIL_CHANGE_REPOSITORY, ODOMETER_REPOSITORY],
})
export class OilModule {}
