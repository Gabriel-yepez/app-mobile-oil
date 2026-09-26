// Los ids de vehículos y cambios los genera la APP, no el backend.
//
// Es lo que permite guardar sin señal: el registro nace con su id definitivo,
// se pinta de inmediato y, cuando la cola lo sincroniza, el servidor usa ese
// mismo id. Nada se remapea, así que no existe la clase de bugs donde un
// cambio de aceite queda apuntando a un vehículo con id viejo.
import { randomUUID } from 'expo-crypto';

export function nuevoId(): string {
  return randomUUID();
}
