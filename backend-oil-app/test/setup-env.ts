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

// ─────────────────────────────────────────────────────────────────────────────
// Por qué cada suite hace `await app.listen(0, '127.0.0.1')` y no `app.init()`:
//
// Con app.init() el servidor no escucha, y supertest hace listen(0) —sobre
// `::`, todas las interfaces— EN CADA PETICIÓN, y luego se conecta a
// 127.0.0.1:puerto. En macOS, si otro proceso ya tiene ese puerto atado a
// 127.0.0.1 en concreto (el IDE, los language servers, Electron: una veintena
// de puertos del rango efímero en esta máquina), Node acepta igual el listen
// sobre `::`… pero la conexión a 127.0.0.1 le llega al OTRO proceso, porque la
// dirección más específica gana.
//
// Síntomas que eso producía, todos intermitentes y en tests que en solitario
// pasaban siempre: 404 en rutas que existen, 403 y 400 inexplicables,
// peticiones que nunca respondían (timeouts de 5 s en una validación que no
// toca la base) y "Jest did not exit". Medido: 5 de cada 3.000 listen(0)
// hablaban con otro proceso; con cientos de peticiones por corrida, fallaba
// más o menos una de cada diez.
//
// Escuchando una sola vez y atado a 127.0.0.1, el sistema solo puede dar un
// puerto libre EN ESA dirección, y supertest reutiliza el servidor en vez de
// abrir uno por petición.
