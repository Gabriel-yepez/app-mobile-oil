// Tipos del subsistema de notificaciones. Sin imports del SDK a propósito.
//
// Lo que decide QUÉ avisar y CUÁNDO vive ahora en el backend: acá solo queda
// lo que la app necesita para recibir un push y saber a dónde llevar al
// usuario cuando lo toque.

/** Prefijo de los avisos que programaba la versión local. Lo único que lo
 *  usa hoy es legacy-cleanup, para cancelar solo lo nuestro. */
export const NOTIF_PREFIX = 'ruedalo:';

export type NotifKind = 'warn' | 'overdue' | 'checkin';

export type NotifRouteData = {
  screen: 'VehicleDetail' | 'Alerts';
  vehicleId?: string;
};
