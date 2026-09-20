// Reconciliación: única capa que habla con expo-notifications.
//
// El diff vive en reconcile(), que es pura y está testeada. syncNotifications()
// es cableado: leer estado → diff → aplicar. Es idempotente, así que llamarla
// de más es inofensivo.
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { useVehicles } from '../store/useVehicles';
import { useNotifPrefs } from '../store/notifPrefs';
import { ensureChannel } from './channels';
import { isPermissionGranted } from './permissions';
import { buildSchedule } from './plan';
import { NOTIF_PREFIX, PlannedNotification, PlannedTrigger } from './types';

export type ScheduledSnapshot = { id: string; sig: string };
export type SyncResult = { scheduled: number; cancelled: number; failed: number };

export function reconcile(
  planned: PlannedNotification[],
  existing: ScheduledSnapshot[]
): { toSchedule: PlannedNotification[]; toCancel: string[] } {
  const bySig = new Map(existing.map((e) => [e.id, e.sig]));
  const plannedById = new Map(planned.map((p) => [p.id, p]));

  const toSchedule = planned.filter((p) => bySig.get(p.id) !== p.sig);
  const toCancel = existing
    .filter((e) => plannedById.get(e.id)?.sig !== e.sig)
    .map((e) => e.id);

  return { toSchedule, toCancel };
}

function toExpoTrigger(t: PlannedTrigger): Notifications.NotificationTriggerInput {
  if (t.type === 'date') {
    return { type: Notifications.SchedulableTriggerInputTypes.DATE, date: t.date };
  }
  return {
    type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
    weekday: t.weekday,
    hour: t.hour,
    minute: t.minute,
  };
}

async function readScheduled(): Promise<ScheduledSnapshot[]> {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  return all
    .filter((r) => r.identifier.startsWith(NOTIF_PREFIX))
    .map((r) => ({
      id: r.identifier,
      // `data` llega del SDK como Record<string, unknown>; la firma la
      // escribimos nosotros al programar.
      sig: String((r.content.data as Record<string, unknown> | undefined)?.sig ?? ''),
    }));
}

export async function syncNotifications(): Promise<SyncResult> {
  const result: SyncResult = { scheduled: 0, cancelled: 0, failed: 0 };
  if (Platform.OS === 'web') return result;

  await ensureChannel();

  const planned = buildSchedule({
    vehicles: useVehicles.getState().vehicles,
    prefs: useNotifPrefs.getState().prefs,
    permissionGranted: await isPermissionGranted(),
    now: new Date(),
  });

  const { toSchedule, toCancel } = reconcile(planned, await readScheduled());

  // Cancelar primero: reprogramar un identificador ya usado sin cancelarlo
  // deja duplicados en algunos dispositivos Android.
  for (const id of toCancel) {
    try {
      await Notifications.cancelScheduledNotificationAsync(id);
      result.cancelled += 1;
    } catch (e) {
      result.failed += 1;
      console.warn(`[notifications] no se pudo cancelar ${id}`, e);
    }
  }

  for (const p of toSchedule) {
    try {
      await Notifications.scheduleNotificationAsync({
        identifier: p.id,
        content: { title: p.title, body: p.body, data: { ...p.data, sig: p.sig } },
        trigger: toExpoTrigger(p.trigger),
      });
      result.scheduled += 1;
    } catch (e) {
      // Un fallo en una notificación no puede abortar las demás ni tumbar la
      // pantalla que disparó la reconciliación.
      result.failed += 1;
      console.warn(`[notifications] no se pudo programar ${p.id}`, e);
    }
  }

  return result;
}
