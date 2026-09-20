// Vehículos que necesitan atención, ordenados por urgencia. Gana relevancia
// ahora que Alertas dejó de ser un tab.
import React from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Box, Col, Touchable, Txt, useAppColors } from '../../ui';
import { Card, SectionHead, StatusPill, VehicleThumb } from '../../components/primitives';
import { Icon } from '../../components/Icon';
import { fmtKm } from '../../utils/format';
import { useVehicles } from '../../store/useVehicles';
import { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function OpenAlertsWidget() {
  const navigation = useNavigation<Nav>();
  const c = useAppColors();
  const vehicles = useVehicles((s) => s.vehicles);

  // Vencidos primero, después los que se acercan.
  const abiertos = vehicles
    .filter((v) => v.gauge !== null && v.gauge.status !== 'ok')
    .sort((a, b) => (a.gauge?.kmLeft ?? 0) - (b.gauge?.kmLeft ?? 0))
    .slice(0, 3);

  // Sin alertas no se pinta nada: una card de "todo en orden" sería ruido fijo.
  if (abiertos.length === 0) return null;

  return (
    <Box>
      <SectionHead
        right={
          <Touchable onPress={() => navigation.navigate('Alerts')} hitSlop={8} fade>
            <Txt font="semi" fos={12} tone="accent">Ver todo</Txt>
          </Touchable>
        }
      >
        Alertas abiertas
      </SectionHead>
      <Col gap={10} px="$lg">
        {abiertos.map((v) => (
          // Card táctil: el chevrón promete navegación, así que tiene que navegar.
          <Card
            key={v.id}
            fd="row"
            ai="center"
            gap="$md"
            onPress={() => navigation.navigate('VehicleDetail', { vehicleId: v.id })}
            pressStyle={{ opacity: 0.85 }}
          >
            <VehicleThumb kind={v.kind} color={v.color} size={36} />
            <Col f={1}>
              <Txt font="bold" fos={14}>{v.brand} {v.model}</Txt>
              <Txt fos={12} tone="muted" mt={1}>
                {(v.gauge?.kmLeft ?? 0) > 0
                  ? `Faltan ${fmtKm(v.gauge?.kmLeft ?? 0)} km`
                  : `Vencido por ${fmtKm(Math.abs(v.gauge?.kmLeft ?? 0))} km`}
              </Txt>
            </Col>
            <StatusPill status={v.gauge?.status ?? 'ok'} />
            <Icon name="chevR" color={c.muted2} size={20} />
          </Card>
        ))}
      </Col>
    </Box>
  );
}
