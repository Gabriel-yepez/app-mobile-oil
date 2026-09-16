// Lista BLANCA a propósito. Excluir campos es frágil: olvidar excluir uno es
// silencioso y filtra el dato; olvidar incluirlo se ve de inmediato en la
// respuesta. El passwordHash no puede salir por accidente si nunca se copia.
import type { Currency, User } from '../../users/domain/user';

export type UserResponse = {
  id: string;
  fullName: string;
  cedula: string;
  email: string;
  phone: string;
  state: string | null;
  city: string | null;
  currency: Currency;
};

export function toUserResponse(user: User): UserResponse {
  return {
    id: user.id,
    fullName: user.fullName,
    cedula: user.cedula,
    email: user.email,
    phone: user.phone,
    state: user.state,
    city: user.city,
    currency: user.currency,
  };
}
