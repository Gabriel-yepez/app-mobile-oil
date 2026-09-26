import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class RefreshDto {
  @ApiProperty({
    minLength: 20,
    maxLength: 200,
    example: 'Rkx1ZGVsUGFzb0RlVG9rZW5BbGVhdG9yaW9EZTQ4Qnl0ZXNFbkJhc2U2NHVybA',
    description:
      'El `refreshToken` que entregó el último `register`, `login` o ' +
      '`refresh`. Nunca el `accessToken`: son cosas distintas y se firman ' +
      'con secretos distintos.',
  })
  @IsString()
  @Length(20, 200)
  refreshToken!: string;
}
