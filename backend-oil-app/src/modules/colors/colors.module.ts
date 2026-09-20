import { Module } from '@nestjs/common';
import { ColorsController } from './colors.controller';

@Module({ controllers: [ColorsController] })
export class ColorsModule {}
