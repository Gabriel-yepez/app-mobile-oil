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
