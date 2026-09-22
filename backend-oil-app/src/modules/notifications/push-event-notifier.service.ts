// La puerta estrecha por la que el dominio del aceite pide un aviso.
//
// Existe para que OilService no tenga que conocer el barrido, el planificador
// ni el tipo PlannerVehicle: le basta con decir "a este usuario le pasó algo".
// Todo el fuego y olvido vive acá, no repartido por cada punto de llamada.
import { Injectable, Logger } from '@nestjs/common';
import { PushDispatchService } from './push-dispatch.service';
import { PushSweepService } from './push-sweep.service';

@Injectable()
export class PushEventNotifier {
  private readonly log = new Logger(PushEventNotifier.name);

  constructor(
    private readonly sweep: PushSweepService,
    private readonly dispatch: PushDispatchService,
  ) {}

  /**
   * Avisa por push si el estado del usuario lo amerita. NO devuelve promesa a
   * propósito: quien la llama no debe poder esperarla ni encadenarle un catch.
   *
   * Corre después de que la escritura ya está confirmada y su fallo se
   * registra pero nunca se propaga: si Expo está caído, el cambio de aceite
   * del usuario ya quedó guardado y la petición tiene que responder bien. El
   * barrido de mañana recoge lo que no salió.
   *
   * No duplica el barrido porque comparte su dedupe: si el aviso de este ciclo
   * ya salió, planPushes calcula la misma firma y calla.
   */
  avisar(userId: string): void {
    // El try de afuera no es redundante: el de adentro solo atrapa lo que
    // falle DESPUÉS de que la promesa arranque. Si algo reventara al lanzarla
    // —una dependencia sin resolver, por ejemplo—, la excepción subiría hasta
    // la petición del usuario y tumbaría un cambio de aceite que ya se guardó.
    // Con los dos, "esto nunca propaga" es una garantía y no una costumbre.
    try {
      void (async () => {
        try {
          const now = new Date();
          const vehiculos = await this.sweep.vehiculosDe(userId, now);
          await this.dispatch.despacharUsuario(userId, vehiculos, now);
        } catch (e) {
          this.fallo(userId, e);
        }
      })();
    } catch (e) {
      this.fallo(userId, e);
    }
  }

  private fallo(userId: string, e: unknown): void {
    this.log.warn(
      `No se pudo avisar por push a ${userId}: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
}
