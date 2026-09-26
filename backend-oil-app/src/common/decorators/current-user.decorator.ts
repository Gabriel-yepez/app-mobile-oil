import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { User } from '../../modules/users/domain/user';

/** El usuario que puso JwtStrategy.validate en la petición. */
export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): User =>
    ctx.switchToHttp().getRequest<{ user: User }>().user,
);
