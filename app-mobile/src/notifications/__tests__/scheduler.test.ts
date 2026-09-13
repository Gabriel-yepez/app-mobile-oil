import { reconcile, ScheduledSnapshot } from '../scheduler';
import { PlannedNotification } from '../types';

const planned = (over: Partial<PlannedNotification> = {}): PlannedNotification => ({
  id: 'ruedalo:oil-warn:v1',
  kind: 'warn',
  title: 'Cambio de aceite cerca',
  body: 'A Toyota Corolla le quedan 400 km de aceite.',
  sig: 'sig-a',
  data: { screen: 'VehicleDetail', vehicleId: 'v1' },
  trigger: { type: 'date', date: 1_800_000_000_000 },
  ...over,
});

const scheduled = (id: string, sig: string): ScheduledSnapshot => ({ id, sig });

describe('reconcile', () => {
  it('programa lo que no existe todavía', () => {
    const out = reconcile([planned()], []);
    expect(out.toSchedule.map((p) => p.id)).toEqual(['ruedalo:oil-warn:v1']);
    expect(out.toCancel).toEqual([]);
  });

  it('deja intacto lo que ya está programado con la misma firma', () => {
    const out = reconcile([planned()], [scheduled('ruedalo:oil-warn:v1', 'sig-a')]);
    expect(out.toSchedule).toEqual([]);
    expect(out.toCancel).toEqual([]);
  });

  it('reprograma cuando la firma cambió', () => {
    const out = reconcile([planned({ sig: 'sig-b' })], [scheduled('ruedalo:oil-warn:v1', 'sig-a')]);
    expect(out.toSchedule.map((p) => p.id)).toEqual(['ruedalo:oil-warn:v1']);
    expect(out.toCancel).toEqual(['ruedalo:oil-warn:v1']);
  });

  it('cancela lo programado que ya no está en el plan', () => {
    const out = reconcile([], [scheduled('ruedalo:oil-warn:v1', 'sig-a')]);
    expect(out.toSchedule).toEqual([]);
    expect(out.toCancel).toEqual(['ruedalo:oil-warn:v1']);
  });

  it('con plan vacío cancela todo lo nuestro', () => {
    const out = reconcile([], [
      scheduled('ruedalo:oil-warn:v1', 'sig-a'),
      scheduled('ruedalo:checkin-weekly', 'sig-c'),
    ]);
    expect(out.toCancel.sort()).toEqual(['ruedalo:checkin-weekly', 'ruedalo:oil-warn:v1']);
  });

  it('es idempotente: reconciliar el resultado ya aplicado no hace nada', () => {
    const plan = [planned()];
    const applied = [scheduled('ruedalo:oil-warn:v1', 'sig-a')];
    expect(reconcile(plan, applied)).toEqual({ toSchedule: [], toCancel: [] });
  });

  it('no cancela una notificación programada que no cambió, aunque otra sí', () => {
    const out = reconcile(
      [planned(), planned({ id: 'ruedalo:checkin-weekly', kind: 'checkin', sig: 'nueva' })],
      [scheduled('ruedalo:oil-warn:v1', 'sig-a'), scheduled('ruedalo:checkin-weekly', 'vieja')]
    );
    expect(out.toSchedule.map((p) => p.id)).toEqual(['ruedalo:checkin-weekly']);
    expect(out.toCancel).toEqual(['ruedalo:checkin-weekly']);
  });
});
