// Solo HTTP: recibe DTO, delega, devuelve DTO. Cero reglas de negocio.
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { User } from '../users/domain/user';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';
import { toUserResponse, type UserResponse } from './dto/user-response.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import type { AuthResult } from './auth.service';
import type { TokenPair } from './token.service';

// Hay dos limitadores activos: 'default' (generoso, para todo) y 'auth'
// (estricto). Las rutas que no adivinan credenciales se saltan el estricto:
// refrescar o pedir /me con frecuencia es uso legítimo de la app, mientras
// que reintentar el login lo es mucho menos.
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto): Promise<AuthResult> {
    return this.auth.register(dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('login')
  login(@Body() dto: LoginDto): Promise<AuthResult> {
    return this.auth.login(dto);
  }

  @SkipThrottle({ auth: true })
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  refresh(@Body() dto: RefreshDto): Promise<TokenPair> {
    return this.auth.refresh(dto.refreshToken);
  }

  @SkipThrottle({ auth: true })
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('logout')
  async logout(@Body() dto: RefreshDto): Promise<void> {
    await this.auth.logout(dto.refreshToken);
  }

  @SkipThrottle({ auth: true })
  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: User): { user: UserResponse } {
    return { user: toUserResponse(user) };
  }
}
