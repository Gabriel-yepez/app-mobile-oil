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
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  ApiErrorResponse,
  ERRORES_COMUNES,
} from '../../common/swagger/api-error-response.decorator';
import type { User } from '../users/domain/user';
import { AuthService } from './auth.service';
import {
  AuthResponseDto,
  MeResponseDto,
  TokenPairDto,
} from './dto/auth-response.dto';
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
@ApiTags('Autenticación')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @ApiOperation({
    summary: 'Crear una cuenta',
    description: [
      'Registra al usuario y lo deja **ya autenticado**: devuelve el par de',
      'tokens en la misma respuesta, así que la app no tiene que llamar a',
      '`/auth/login` justo después.',
      '',
      'Antes de validar, el cuerpo pasa por una normalización: la cédula',
      'pierde puntos y guiones, el correo se pasa a minúsculas y los textos se',
      'recortan. El valor que se guarda es el normalizado, y es el que verás',
      'de vuelta en `user`.',
      '',
      'El correo y la cédula se comprueban **por separado** para poder decir',
      'cuál de los dos chocó: el formulario necesita marcar el campo correcto,',
      'y un único error "ya existe" no alcanzaría para eso.',
      '',
      'El registro pide el **perfil completo**: además de las credenciales, el',
      'estado y la ciudad son obligatorios. `currency` es el único opcional —',
      'si no viene, queda en `BOTH`.',
      '',
      'El estado y la ciudad también se normalizan: espacios recortados y',
      'mayúscula inicial por palabra, dejando los conectores en minúscula',
      '("San Juan de los Morros"). Sin eso, "Caracas", "caracas" y "CARACAS"',
      'acabarían siendo tres zonas distintas en cualquier agrupación.',
      '',
      '**Límite:** `THROTTLE_AUTH_LIMIT` peticiones por minuto y por IP',
      '(5 por defecto).',
    ].join('\n'),
  })
  @ApiBody({ type: RegisterDto })
  @ApiCreatedResponse({
    description: 'Cuenta creada. Vienen el usuario y el par de tokens.',
    type: AuthResponseDto,
  })
  @ApiErrorResponse(
    HttpStatus.BAD_REQUEST,
    'El cuerpo no pasó la validación.',
    {
      formato: {
        resumen: 'algún campo no cumple su regla',
        error: 'VALIDATION_ERROR',
        message: 'Revisa los datos enviados.',
        details: [
          'La cédula no tiene un formato válido',
          'La contraseña debe incluir al menos una letra y un número',
        ],
      },
      camposDeMas: ERRORES_COMUNES.camposDeMas,
    },
  )
  @ApiErrorResponse(
    HttpStatus.CONFLICT,
    'Ya hay una cuenta con ese correo o con esa cédula. Ramifica por `error` ' +
      'para saber cuál de los dos campos marcar en el formulario.',
    {
      correo: {
        resumen: 'el correo ya está registrado',
        error: 'EMAIL_TAKEN',
        message: 'Ese correo ya tiene una cuenta.',
      },
      cedula: {
        resumen: 'la cédula ya está registrada (comparada ya normalizada)',
        error: 'CEDULA_TAKEN',
        message: 'Esa cédula ya tiene una cuenta.',
      },
    },
  )
  @ApiErrorResponse(
    HttpStatus.TOO_MANY_REQUESTS,
    'Se agotó el límite estricto de autenticación para esta IP.',
    { limite: ERRORES_COMUNES.limite },
  )
  @ApiErrorResponse(
    HttpStatus.INTERNAL_SERVER_ERROR,
    'Falla inesperada. El detalle va al log del servidor, nunca a la ' +
      'respuesta: un stack trace le entregaría al atacante la estructura ' +
      'interna de la aplicación.',
    { interno: ERRORES_COMUNES.interno },
  )
  @Post('register')
  register(@Body() dto: RegisterDto): Promise<AuthResult> {
    return this.auth.register(dto);
  }

  @ApiOperation({
    summary: 'Iniciar sesión',
    description: [
      'Valida las credenciales y entrega un par de tokens nuevo.',
      '',
      'Responde **200 y no 201**: iniciar sesión no crea un recurso.',
      '',
      '**Correo inexistente y contraseña errada devuelven exactamente el',
      'mismo cuerpo, el mismo código y —esto es lo importante— tardan lo',
      'mismo.** El servicio verifica siempre contra un hash señuelo cuando el',
      'correo no existe, en vez de salir antes. Sin eso, la rama "no existe"',
      'respondería en microsegundos frente a los ~14 ms de una verificación',
      'real, y esa diferencia de tiempo bastaría para averiguar qué correos',
      'tienen cuenta. Hay un test que mide justamente eso.',
      '',
      '**Límite:** `THROTTLE_AUTH_LIMIT` peticiones por minuto y por IP',
      '(5 por defecto). Es la ruta más expuesta a fuerza bruta.',
    ].join('\n'),
  })
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({
    description: 'Credenciales correctas. Vienen el usuario y los tokens.',
    type: AuthResponseDto,
  })
  @ApiErrorResponse(
    HttpStatus.BAD_REQUEST,
    'El cuerpo no pasó la validación (falta un campo, el correo no tiene ' +
      'forma de correo, o llegó un campo de más).',
    {
      formato: ERRORES_COMUNES.validacion,
      camposDeMas: ERRORES_COMUNES.camposDeMas,
    },
  )
  @ApiErrorResponse(
    HttpStatus.UNAUTHORIZED,
    'Credenciales inválidas. Un solo motivo documentado a propósito: la API ' +
      'no distingue entre "ese correo no existe" y "esa contraseña no es".',
    {
      credenciales: {
        resumen: 'correo inexistente o contraseña errada, indistinguibles',
        error: 'INVALID_CREDENTIALS',
        message: 'Correo o contraseña incorrectos.',
      },
    },
  )
  @ApiErrorResponse(
    HttpStatus.TOO_MANY_REQUESTS,
    'Se agotó el límite estricto de autenticación para esta IP.',
    { limite: ERRORES_COMUNES.limite },
  )
  @ApiErrorResponse(HttpStatus.INTERNAL_SERVER_ERROR, 'Falla inesperada.', {
    interno: ERRORES_COMUNES.interno,
  })
  @HttpCode(HttpStatus.OK)
  @Post('login')
  login(@Body() dto: LoginDto): Promise<AuthResult> {
    return this.auth.login(dto);
  }

  @ApiOperation({
    summary: 'Renovar el par de tokens',
    description: [
      'Cambia un `refreshToken` válido por un par nuevo, sin pedir la',
      'contraseña. Es lo que debe hacer la app cuando una petición protegida',
      'responde 401 por vencimiento del `accessToken`.',
      '',
      '**Los refresh son de un solo uso (rotación).** El que envías queda',
      'invalidado en el acto y recibes otro distinto: guarda el nuevo y tira',
      'el viejo.',
      '',
      '**Reusar un refresh ya rotado revoca TODAS las sesiones del usuario.**',
      'Que un token gastado vuelva a aparecer solo tiene una explicación:',
      'existen dos copias, la legítima y una robada. Como no hay forma de',
      'saber cuál es cuál, se caen ambas y el dueño vuelve a iniciar sesión.',
      'Ojo con esto al programar el cliente: **dos refrescos en paralelo con',
      'el mismo token cierran la sesión del usuario.** Serializa la renovación.',
      '',
      'El `accessToken` que sale de aquí lleva el correo vacío en su payload:',
      'solo necesita el `sub`, porque la estrategia JWT relee al usuario de la',
      'base en cada petición.',
      '',
      '**Límite:** se salta el limitador estricto (`@SkipThrottle`) y solo le',
      'aplica el general, 100 por minuto y por IP. Refrescar seguido es uso',
      'normal de la app, no un intento de adivinar credenciales.',
    ].join('\n'),
  })
  @ApiBody({ type: RefreshDto })
  @ApiOkResponse({
    description:
      'Par nuevo. El `refreshToken` que enviaste ya no sirve a partir de ' +
      'este momento.',
    type: TokenPairDto,
  })
  @ApiErrorResponse(
    HttpStatus.BAD_REQUEST,
    'Falta `refreshToken`, no es texto, o su longitud está fuera de 20–200.',
    {
      formato: {
        resumen: 'el campo no cumple su regla',
        error: 'VALIDATION_ERROR',
        message: 'Revisa los datos enviados.',
        details: ['refreshToken must be longer than or equal to 20 characters'],
      },
    },
  )
  @ApiErrorResponse(
    HttpStatus.UNAUTHORIZED,
    'El refresh no sirve. Los cuatro motivos comparten un único código a ' +
      'propósito; la app reacciona igual en todos: mandar al login.',
    {
      desconocido: {
        resumen: 'el token no existe, o ya se cerró sesión con él',
        error: 'INVALID_REFRESH_TOKEN',
        message: 'Tu sesión expiró. Inicia sesión de nuevo.',
      },
      vencido: {
        resumen: 'pasaron los 30 días de JWT_REFRESH_TTL',
        error: 'INVALID_REFRESH_TOKEN',
        message: 'Tu sesión expiró. Inicia sesión de nuevo.',
      },
      reusado: {
        resumen:
          'se reusó un token ya rotado: se revocaron TODAS las sesiones ' +
          'del usuario, incluida la legítima',
        error: 'INVALID_REFRESH_TOKEN',
        message: 'Tu sesión expiró. Inicia sesión de nuevo.',
      },
    },
  )
  @ApiErrorResponse(
    HttpStatus.TOO_MANY_REQUESTS,
    'Se pasó del límite general de 100 peticiones por minuto y por IP.',
    { limite: ERRORES_COMUNES.limite },
  )
  @ApiErrorResponse(HttpStatus.INTERNAL_SERVER_ERROR, 'Falla inesperada.', {
    interno: ERRORES_COMUNES.interno,
  })
  @SkipThrottle({ auth: true })
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  refresh(@Body() dto: RefreshDto): Promise<TokenPair> {
    return this.auth.refresh(dto.refreshToken);
  }

  @ApiOperation({
    summary: 'Cerrar sesión',
    description: [
      'Revoca el `refreshToken` enviado. El `accessToken` que ya esté en',
      'circulación **sigue siendo válido hasta que venza** (15 minutos por',
      'defecto): un JWT no se puede desfirmar. Bórralo también en el cliente.',
      '',
      'Cierra **una sola sesión**, la de ese refresh, no todos los',
      'dispositivos del usuario.',
      '',
      'Es idempotente: revocar un token que ya estaba revocado o que no',
      'existe también responde 204. Cerrar sesión dos veces no es un error.',
      '',
      'Requiere `Authorization: Bearer <accessToken>` **además** del',
      '`refreshToken` en el cuerpo: el header dice quién pide, el cuerpo dice',
      'cuál sesión cerrar.',
      '',
      '**Límite:** se salta el limitador estricto; solo aplica el general.',
    ].join('\n'),
  })
  @ApiBearerAuth('access-token')
  @ApiBody({ type: RefreshDto })
  @ApiNoContentResponse({
    description: 'Sesión cerrada. **Sin cuerpo de respuesta.**',
  })
  @ApiErrorResponse(
    HttpStatus.BAD_REQUEST,
    'Falta `refreshToken` o su longitud está fuera de 20–200.',
    { formato: ERRORES_COMUNES.validacion },
  )
  @ApiErrorResponse(
    HttpStatus.UNAUTHORIZED,
    'Cuatro motivos con código propio cada uno: `UNAUTHORIZED` (no vino el ' +
      'header), `TOKEN_EXPIRED` (venció), `INVALID_TOKEN` (mal firmado) y ' +
      '`ACCOUNT_NOT_FOUND` (la cuenta ya no existe). Ante `TOKEN_EXPIRED` ' +
      'refresca y reintenta el cierre; ante los otros tres no hay sesión que ' +
      'cerrar en el servidor, así que basta con borrar lo guardado en el ' +
      'dispositivo.',
    {
      sinToken: ERRORES_COMUNES.sinToken,
      vencido: ERRORES_COMUNES.vencido,
      malFirmado: ERRORES_COMUNES.malFirmado,
      cuentaBorrada: ERRORES_COMUNES.cuentaBorrada,
    },
  )
  @ApiErrorResponse(
    HttpStatus.TOO_MANY_REQUESTS,
    'Se pasó del límite general de 100 peticiones por minuto y por IP.',
    { limite: ERRORES_COMUNES.limite },
  )
  @ApiErrorResponse(HttpStatus.INTERNAL_SERVER_ERROR, 'Falla inesperada.', {
    interno: ERRORES_COMUNES.interno,
  })
  @SkipThrottle({ auth: true })
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('logout')
  async logout(@Body() dto: RefreshDto): Promise<void> {
    await this.auth.logout(dto.refreshToken);
  }

  @ApiOperation({
    summary: 'Ver el usuario de la sesión actual',
    description: [
      'Devuelve el perfil de quien trae el `accessToken`. La app la usa al',
      'arrancar para saber si la sesión guardada sigue viva.',
      '',
      'El usuario **se relee de la base en cada petición** en vez de',
      'reconstruirse desde el payload del JWT. Cuesta una consulta, pero a',
      'cambio una cuenta borrada deja de entrar de inmediato, sin esperar a',
      'que expire el token, y los datos que devuelve están siempre al día.',
      '',
      'El usuario viene envuelto en `{ "user": ... }` y no suelto, para poder',
      'añadir cosas al lado más adelante sin romper a los clientes.',
      '',
      '**Límite:** se salta el limitador estricto; solo aplica el general.',
    ].join('\n'),
  })
  @ApiBearerAuth('access-token')
  @ApiOkResponse({
    description: 'La sesión es válida. Viene el usuario, sin `passwordHash`.',
    type: MeResponseDto,
  })
  @ApiErrorResponse(
    HttpStatus.UNAUTHORIZED,
    'Cuatro motivos con código propio, y la app reacciona distinto a cada ' +
      'uno. **Solo el primero se arregla refrescando**; tratarlos todos ' +
      'igual hace que la app reintente sesiones que ya no pueden existir.' +
      '\n\n' +
      '- **`TOKEN_EXPIRED`** — el access venció (pasa cada 15 min: es el ' +
      'caso más común). Llama a `POST /auth/refresh` y reintenta, sin ' +
      'mostrarle nada al usuario.\n' +
      '- **`UNAUTHORIZED`** — no vino el header `Authorization`. No hay ' +
      'sesión: manda al login.\n' +
      '- **`INVALID_TOKEN`** — el token está mal formado o mal firmado ' +
      '(guardado corrupto, o manipulado). Limpia el almacenamiento y manda ' +
      'al login.\n' +
      '- **`ACCOUNT_NOT_FOUND`** — el token es válido, pero la cuenta que ' +
      'nombra ya no está en la base. Refrescar es un viaje perdido: al ' +
      'borrarse el usuario cayeron sus refresh en cascada. Limpia el ' +
      'dispositivo y manda al registro.',
    {
      vencido: ERRORES_COMUNES.vencido,
      sinToken: ERRORES_COMUNES.sinToken,
      malFirmado: ERRORES_COMUNES.malFirmado,
      cuentaBorrada: ERRORES_COMUNES.cuentaBorrada,
    },
  )
  @ApiErrorResponse(
    HttpStatus.TOO_MANY_REQUESTS,
    'Se pasó del límite general de 100 peticiones por minuto y por IP.',
    { limite: ERRORES_COMUNES.limite },
  )
  @ApiErrorResponse(HttpStatus.INTERNAL_SERVER_ERROR, 'Falla inesperada.', {
    interno: ERRORES_COMUNES.interno,
  })
  @SkipThrottle({ auth: true })
  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: User): { user: UserResponse } {
    return { user: toUserResponse(user) };
  }
}
