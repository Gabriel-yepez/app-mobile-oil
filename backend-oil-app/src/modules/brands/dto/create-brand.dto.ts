import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, Length } from 'class-validator';
import { LARGO_MAX } from '../domain/brand-name';

export class CreateBrandDto {
  @ApiProperty({
    format: 'uuid',
    required: false,
    description:
      'Lo genera la app para poder agregar sin señal. Si ya existe, la respuesta es 200 con la marca guardada: es un reintento de la cola, no un error.',
  })
  @IsOptional()
  @IsUUID('4')
  id?: string;

  @ApiProperty({ enum: ['CAR', 'MOTO'] })
  @IsIn(['CAR', 'MOTO'])
  kind!: 'CAR' | 'MOTO';

  @ApiProperty({
    minLength: 1,
    maxLength: LARGO_MAX,
    example: 'Chery',
    description:
      'El charset real lo valida el servicio y devuelve BRAND_NAME_INVALID. Acá solo se acota el largo.',
  })
  @IsString()
  @Length(1, LARGO_MAX)
  name!: string;
}

export class ListBrandsQueryDto {
  @ApiProperty({ enum: ['CAR', 'MOTO'] })
  @IsIn(['CAR', 'MOTO'])
  kind!: 'CAR' | 'MOTO';
}
