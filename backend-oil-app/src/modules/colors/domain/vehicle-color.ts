// Catálogo de colores de vehículo.
//
// Es una constante y no una tabla a propósito. Las marcas tienen tabla porque
// LOS USUARIOS LAS ESCRIBEN; los colores no los escribe nadie. Una tabla acá
// solo compraría cambiar un tono por SQL sin redesplegar, y un deploy de
// backend es barato al lado de una release de la app — que es el problema que
// resolvemos al sacar esta lista del cliente.
//
// PARA AGREGAR UN COLOR: sumalo abajo con un hex de seis dígitos y corré el
// spec. Para QUITAR uno, mirá primero si hay vehículos usándolo: su hex queda
// huérfano y la app va a mostrarlos como "otro color".
//
//   select color, count(*) from "Vehicle" group by color;

export type VehicleColor = { name: string; hex: string };

/** El orden es el que ve el usuario: de oscuro a claro y después los vivos. */
export const COLORES: readonly VehicleColor[] = [
  { name: 'Negro', hex: '#1F2937' },
  { name: 'Gris', hex: '#9CA3AF' },
  { name: 'Plata', hex: '#D1D5DB' },
  { name: 'Blanco', hex: '#F3F4F6' },
  { name: 'Rojo', hex: '#DC2626' },
  { name: 'Vinotinto', hex: '#7F1D1D' },
  { name: 'Azul', hex: '#2563EB' },
  { name: 'Verde', hex: '#059669' },
  { name: 'Amarillo', hex: '#FACC15' },
  { name: 'Beige', hex: '#D6C7A8' },
];
