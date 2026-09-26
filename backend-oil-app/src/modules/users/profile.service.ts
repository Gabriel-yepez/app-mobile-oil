// El perfil de la cuenta propia. Separado de AuthService a propósito: aquel se
// ocupa de credenciales y sesiones (registrar, entrar, rotar, salir), y editar
// el nombre o la ciudad no es ninguna de esas cosas.
import { Inject, Injectable } from '@nestjs/common';
import { Errors } from '../../common/errors';
import type { User } from './domain/user';
import {
  USER_REPOSITORY,
  type UserProfilePatch,
  type UserRepository,
} from './domain/user.repository';

/** Las claves editables, en una sola lista de la que salen el diff y el patch. */
const EDITABLES = [
  'fullName',
  'email',
  'phone',
  'state',
  'city',
  'currency',
] as const;

export type CampoEditable = (typeof EDITABLES)[number];

/**
 * Lo que acepta el servicio: el patch de dominio, no el DTO de HTTP.
 *
 * `UpdateProfileDto` lo cumple estructuralmente, y a cambio el servicio se
 * puede testear con un objeto pelado, sin instanciar un DTO ni arrastrar
 * class-validator a un test de negocio.
 */
export type UpdateProfileInput = UserProfilePatch;

export type ProfileUpdate = {
  user: User;
  /** Qué cambió de verdad. Vacío = el usuario guardó sin tocar nada. */
  changed: CampoEditable[];
};

@Injectable()
export class ProfileService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
  ) {}

  /**
   * Aplica el patch sobre el usuario de la sesión.
   *
   * Recibe el `User` ya cargado y no un id: la estrategia JWT lo relee de la
   * base en cada petición, así que pedirlo otra vez sería una consulta de más
   * para tener exactamente la misma fila.
   */
  async updateProfile(
    user: User,
    patch: UpdateProfileInput,
  ): Promise<ProfileUpdate> {
    // Solo lo que CAMBIA de verdad. Mandar el formulario entero es lo normal
    // —la pantalla no sabe qué campos tocó el usuario— y sin este filtro
    // reenviar el correo propio sin tocarlo chocaría contra el índice único y
    // saldría un 409 EMAIL_TAKEN por la cuenta de uno mismo.
    const cambios: UserProfilePatch = {};
    const changed: CampoEditable[] = [];

    for (const campo of EDITABLES) {
      const valor = patch[campo];
      if (valor === undefined || valor === user[campo]) continue;
      Object.assign(cambios, { [campo]: valor });
      changed.push(campo);
    }

    if (changed.length === 0) return { user, changed };

    // Se comprueba solo si el correo está entre los cambios: llegados acá ya
    // se sabe que es distinto del propio, así que encontrarlo ocupado
    // significa que es de otra cuenta.
    if (
      cambios.email !== undefined &&
      (await this.users.existsByEmail(cambios.email))
    ) {
      throw Errors.emailTaken();
    }

    return { user: await this.users.update(user.id, cambios), changed };
  }
}
