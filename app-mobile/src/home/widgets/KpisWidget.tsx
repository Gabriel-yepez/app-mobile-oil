// Tres KPIs de un vistazo: tamaño de la flota, días desde el último cambio y
// alertas abiertas.
import React from 'react';
import { Row, useAppColors } from '../../ui';
import { KPI } from '../../components/primitives';
import { Icon } from '../../components/Icon';
import { useActiveVehicle, useVehicles } from '../../store/useVehicles';

export function KpisWidget() {
  const c = useAppColors();
  const vehicles = useVehicles((s) => s.vehicles);
  const active = useActiveVehicle();

  // Antes era `active.daysSince`, un contador que el mock mantenía a mano y
  // que había que acordarse de resetear. Ahora se deriva de la fecha real del
  // último cambio: un campo menos que puede quedar desincronizado.
  const diasDesdeCambio = active?.lastChangeAt
    ? Math.max(
        0,
        Math.floor(
          (Date.now() - new Date(active.lastChangeAt).getTime()) / 86_400_000,
        ),
      )
    : null;

  return (
    <Row gap={10} px="$lg" ai="stretch">
      <KPI icon={<Icon name="car" color={c.accent} size={18} />} label="Vehículos" value={vehicles.length} unit="activos" />
      <KPI icon={<Icon name="calendar" color={c.accent} size={18} />} label="Últ. cambio" value={diasDesdeCambio ?? '—'} unit="días" />
    </Row>
  );
}
