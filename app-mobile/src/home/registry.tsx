// Catálogo de widgets del inicio.
//
// Es el único lugar que hay que tocar para agregar un widget: una entrada acá y
// su id en WIDGET_ORDER. HomeScreen no se entera.
import React, { ReactNode } from 'react';
import { IconName } from '../components/Icon';
import { WidgetId } from './layout';
import { OilStatusWidget } from './widgets/OilStatusWidget';
import { KpisWidget } from './widgets/KpisWidget';
import { RecentHistoryWidget } from './widgets/RecentHistoryWidget';
import { QuickActionsWidget } from './widgets/QuickActionsWidget';
import { OpenAlertsWidget } from './widgets/OpenAlertsWidget';

export type WidgetDef = {
  /** Nombre en la pantalla de personalización. */
  label: string;
  /** Línea de ayuda debajo del nombre. */
  description: string;
  icon: IconName;
  render: () => ReactNode;
};

export const HOME_WIDGETS: Record<WidgetId, WidgetDef> = {
  oilStatus: {
    label: 'Estado del aceite',
    description: 'Medidor, odómetro, próximo cambio y aceite',
    icon: 'gauge',
    render: () => <OilStatusWidget />,
  },
  kpis: {
    label: 'Resumen',
    description: 'Vehículos, último cambio y alertas',
    icon: 'spark',
    render: () => <KpisWidget />,
  },
  quickActions: {
    label: 'Accesos rápidos',
    description: 'Registrar cambio, agregar vehículo, historial',
    icon: 'plus',
    render: () => <QuickActionsWidget />,
  },
  recentHistory: {
    label: 'Historial reciente',
    description: 'Los últimos tres cambios',
    icon: 'history',
    render: () => <RecentHistoryWidget />,
  },
  openAlerts: {
    label: 'Alertas abiertas',
    description: 'Vehículos que necesitan atención',
    icon: 'bell',
    render: () => <OpenAlertsWidget />,
  },
};
