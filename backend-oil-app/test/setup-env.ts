// Entorno fijo para TODOS los e2e, antes de que cualquier suite importe nada.
//
// Los e2e no pueden depender del .env de quien los corre. Dos suites fijaban
// PUSH_ENABLED por su cuenta y el resto lo heredaba del .env: con un .env
// generado antes de que existiera push, esas suites cargaban el SDK de Expo y
// Jest reventaba en el import() dinámico ("A dynamic import callback was
// invoked without --experimental-vm-modules"). El fallo aparecía o no según la
// máquina.
//
// Se asigna sin mirar lo que hubiera: un e2e jamás debe mandar notificaciones
// de verdad. dotenv no pisa variables ya presentes, así que esto gana.
process.env.PUSH_ENABLED = 'false';

// ─────────────────────────────────────────────────────────────────────────────
// Por qué jest-e2e.json fija `maxWorkers: 1` (un JSON no admite comentarios):
//
// Todas las suites comparten la misma base y cada una llama en su afterAll a
// limpiarUsuariosE2E, que borra TODAS las cuentas @e2e.local — a propósito,
// para recoger también la basura de corridas que se cayeron a medias. En
// paralelo, la suite que termina primero se llevaba los usuarios que otra
// estaba usando: aparecían violaciones de clave foránea (un refresh token
// para un usuario recién borrado) y 500 al editar un vehículo que ya no
// existía. Fallaba una de cada tres corridas, cada vez en tests distintos.
// En serie, cada suite limpia cuando ninguna otra está corriendo.
