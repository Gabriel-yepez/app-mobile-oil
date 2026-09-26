// Cuerpo de POST /me/devices.
//
// Sin @Transform: no hay nada que normalizar, y el par @Transform +
// @IsOptional es justo el que convierte un campo ausente en '' y hace rebotar
// lo que el cliente nunca mandó. Ver users/dto/update-profile.dto.ts.
import { ApiProperty } from '@nestjs/swagger';
import {
  IsIn,
  IsString,
  Validate,
  ValidatorConstraint,
  type ValidatorConstraintInterface,
} from 'class-validator';
import { esTokenExpo } from '../domain/push-message';

@ValidatorConstraint({ name: 'esTokenExpo' })
export class TokenExpoValido implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return esTokenExpo(value);
  }

  defaultMessage(): string {
    return 'El token no tiene formato de ExpoPushToken.';
  }
}

export class RegisterDeviceDto {
  @ApiProperty({
    example: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]',
    description:
      'El token que devuelve getExpoPushTokenAsync en el dispositivo.',
  })
  @IsString()
  @Validate(TokenExpoValido)
  token!: string;

  @ApiProperty({ enum: ['IOS', 'ANDROID'], example: 'ANDROID' })
  @IsIn(['IOS', 'ANDROID'])
  platform!: 'IOS' | 'ANDROID';
}
