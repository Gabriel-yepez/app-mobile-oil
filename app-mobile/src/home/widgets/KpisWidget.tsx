// Tres KPIs de un vistazo: tamaño de la flota, días desde el último cambio y
// alertas abiertas.
import React from 'react';
import { Row, useAppColors } from '../../ui';
import { KPI } from '../../components/primitives';
import { Icon } from '../../components/Icon';
import { useActiveVehicle, useOpenAlerts, useStore } from '../../store/useStore';

export function KpisWidget() {
  const c = useAppColors();
  const vehicles = useStore((s) => s.vehicles);
  const active = useActiveVehicle();
  const openAlerts = useOpenAlerts();

  return (
    <Row gap={10} px="$lg" ai="stretch">
      <KPI icon={<Icon name="car" color={c.accent} size={18} />} label="Vehículos" value={vehicles.length} unit="activos" />
      <KPI icon={<Icon name="calendar" color={c.accent} size={18} />} label="Últ. cambio" value={active.daysSince} unit="días" />
      <KPI icon={<Icon name="bell" color={c.warn} size={18} />} label="Alertas" value={openAlerts} unit="abiertas" />
    </Row>
  );
}
