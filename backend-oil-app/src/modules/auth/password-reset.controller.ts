// Recuperar contraseña: tres pasos, un endpoint por paso. Solo HTTP; la lógica
// vive en PasswordResetService.
//
// Las tres rutas usan el limitador estricto de autenticación (no llevan
// @SkipThrottle): todas sirven para adivinar algo —qué correos existen, qué
// código llegó— y la de verificar tiene además su tope de intentos por código.
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
} from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBody,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  ApiErrorResponse,
  ERRORES_COMUNES,
} from '../../common/swagger/api-error-response.decorator';
import {
  ForgotPasswordDto,
  ForgotPasswordResponseDto,
  ResetPasswordDto,
  VerifyResetCodeDto,
  VerifyResetCodeResponseDto,
} from './dto/password-reset.dto';
import { PasswordResetService } from './password-reset.service';

const LIMITE =
  '**Límite:** `THROTTLE_AUTH_LIMIT` peticiones por minuto y por IP ' +
  '(5 por defecto).';

@ApiTags('Autenticación')
@Controller('auth/password')
export class PasswordResetController {
  private readonly logger = new Logger(PasswordResetController.name);

  constructor(private readonly resets: PasswordResetService) {}

  @ApiOperation({
    summary: 'Recuperar contraseña — 1. Pedir el código',
    description: [
      'Si hay una cuenta con ese correo, le envía un código de 6 dígitos que',
      'vence en 15 minutos. Pedir otro invalida el anterior.',
      '',
      '**Responde siempre igual, exista o no la cuenta** —mismo cuerpo, mismo',
      'código y mismo tiempo—. El trabajo se hace después de responder, así',
      'que ni siquiera la latencia distingue un caso del otro. Si no fuera',
      'así, este endpoint serviría para averiguar qué correos tienen cuenta.',
      '',
      LIMITE,
    ].join('\n'),
  })
  @ApiBody({ type: ForgotPasswordDto })
  @ApiAcceptedResponse({
    description: 'Aceptado. Si la cuenta existe, el código va en camino.',
    type: ForgotPasswordResponseDto,
  })
  @ApiErrorResponse(
    HttpStatus.BAD_REQUEST,
    'El correo no tiene forma de correo.',
    {
      formato: ERRORES_COMUNES.validacion,
      camposDeMas: ERRORES_COMUNES.camposDeMas,
    },
  )
  @ApiErrorResponse(HttpStatus.TOO_MANY_REQUESTS, 'Límite estricto agotado.', {
    limite: ERRORES_COMUNES.limite,
  })
  @HttpCode(HttpStatus.ACCEPTED)
  @Post('forgot')
  forgot(@Body() dto: ForgotPasswordDto): ForgotPasswordResponseDto {
    // Sin await, a propósito: se responde ANTES de buscar la cuenta. Con
    // await, la rama "existe" tardaría más (inserta el código) que la rama
    // "no existe", y esa diferencia de tiempo delataría la cuenta.
    this.resets
      .solicitarCodigo(dto.email)
      .catch((e: unknown) =>
        this.logger.error(
          'Falló la solicitud de código de recuperación',
          e instanceof Error ? e.stack : String(e),
        ),
      );

    return {
      message: 'Si hay una cuenta con ese correo, te enviamos un código.',
    };
  }

  @ApiOperation({
    summary: 'Recuperar contraseña — 2. Verificar el código',
    description: [
      'Comprueba el código y entrega un `resetToken` de un solo uso, válido',
      '10 minutos, para el último paso.',
      '',
      '**Un único error para todo:** código errado, vencido, agotado, sin',
      'pedir, o correo sin cuenta dan el mismo `INVALID_RESET_CODE`.',
      'Distinguirlos delataría qué correos están registrados.',
      '',
      'Cada código admite **5 intentos**; después queda inservible y hay que',
      'pedir otro.',
      '',
      LIMITE,
    ].join('\n'),
  })
  @ApiBody({ type: VerifyResetCodeDto })
  @ApiOkResponse({
    description: 'Código correcto.',
    type: VerifyResetCodeResponseDto,
  })
  @ApiErrorResponse(
    HttpStatus.BAD_REQUEST,
    'El cuerpo no es válido, o el código no sirve.',
    {
      codigo: {
        resumen: 'errado, vencido, agotado o de un correo sin cuenta',
        error: 'INVALID_RESET_CODE',
        message: 'El código no es válido o ya venció. Pide uno nuevo.',
      },
      formato: {
        resumen: 'el código no son 6 dígitos',
        error: 'VALIDATION_ERROR',
        message: 'Revisa los datos enviados.',
        details: ['El código son 6 dígitos'],
      },
    },
  )
  @ApiErrorResponse(HttpStatus.TOO_MANY_REQUESTS, 'Límite estricto agotado.', {
    limite: ERRORES_COMUNES.limite,
  })
  @HttpCode(HttpStatus.OK)
  @Post('verify')
  verify(@Body() dto: VerifyResetCodeDto): Promise<VerifyResetCodeResponseDto> {
    return this.resets.verificarCodigo(dto.email, dto.code);
  }

  @ApiOperation({
    summary: 'Recuperar contraseña — 3. Fijar la contraseña nueva',
    description: [
      'Cambia la contraseña con el `resetToken` del paso anterior.',
      '',
      'La contraseña debe tener entre 8 y 72 caracteres, una mayúscula, un',
      'número y un carácter especial. **Cada regla se valida por separado**:',
      'si fallan varias, `details` las trae todas a la vez.',
      '`confirmPassword` debe ser idéntica, y eso también lo valida el',
      'servidor.',
      '',
      'Al terminar **se cierran todas las sesiones** de la cuenta (si alguien',
      'la había robado, lo echa) y se avisa por correo del cambio. No inicia',
      'sesión: la app vuelve al login.',
      '',
      LIMITE,
    ].join('\n'),
  })
  @ApiBody({ type: ResetPasswordDto })
  @ApiNoContentResponse({ description: 'Contraseña cambiada.' })
  @ApiErrorResponse(
    HttpStatus.BAD_REQUEST,
    'La contraseña no cumple la regla, la confirmación no coincide, o el ' +
      'token no sirve.',
    {
      reglas: {
        resumen: 'incumple varias reglas: vienen todas',
        error: 'VALIDATION_ERROR',
        message: 'Revisa los datos enviados.',
        details: [
          'Debe incluir al menos una letra mayúscula',
          'Debe incluir al menos un carácter especial',
        ],
      },
      confirmacion: {
        resumen: 'la confirmación no coincide',
        error: 'VALIDATION_ERROR',
        message: 'Revisa los datos enviados.',
        details: ['Las contraseñas no coinciden'],
      },
      token: {
        resumen: 'token vencido, usado o inventado',
        error: 'INVALID_RESET_TOKEN',
        message:
          'El tiempo para cambiar la contraseña terminó. Empieza de nuevo.',
      },
    },
  )
  @ApiErrorResponse(HttpStatus.TOO_MANY_REQUESTS, 'Límite estricto agotado.', {
    limite: ERRORES_COMUNES.limite,
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('reset')
  async reset(@Body() dto: ResetPasswordDto): Promise<void> {
    await this.resets.restablecer(dto.resetToken, dto.password);
  }
}
