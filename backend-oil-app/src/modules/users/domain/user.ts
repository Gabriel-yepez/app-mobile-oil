// El usuario como lo entiende el negocio. Deliberadamente SIN tipos de Prisma:
// si el dominio importara `@prisma/client`, cambiar de motor dejaría de ser una
// línea, porque el acoplamiento se filtraría por los tipos a toda la app.
export type Currency = 'USD' | 'BS' | 'BOTH';

export type User = {
  id: string;
  email: string;
  cedula: string;
  passwordHash: string;
  fullName: string;
  phone: string;
  state: string | null;
  city: string | null;
  currency: Currency;
  createdAt: Date;
  updatedAt: Date;
};

/** Lo que hace falta para crear uno: el id y las fechas los pone el almacén. */
export type NewUser = Omit<User, 'id' | 'createdAt' | 'updatedAt'>;
