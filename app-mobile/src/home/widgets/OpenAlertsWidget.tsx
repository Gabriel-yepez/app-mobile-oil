// Vehículos que necesitan atención, ordenados por urgencia. Gana relevancia
// ahora que Alertas dejó de ser un tab.
import React from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Box, Col, Touchable, Txt, useAppColors } from '../../ui';
import { Card, SectionHead, StatusPill, VehicleThumb } from '../../components/primitives';
import { Icon } from '../../components/Icon';
import { fmtKm } from '../../utils/format';
import { kmLeft, useStore, vehicleStatus } from '../../store/useStore';
import { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function OpenAlertsWidget() {
  const navigation = useNavigation<Nav>();
  const c = useAppColors();
  const vehicles = useStore((s) => s.vehicles);

  // Vencidos primero, después los que se acercan.
  const abiertos = vehicles
    .filter((v) => vehicleStatus(v) !== 'ok')
    .sort((a, b) => kmLeft(a) - kmLeft(b))
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
                {kmLeft(v) > 0
                  ? `Faltan ${fmtKm(kmLeft(v))} km`
                  : `Vencido por ${fmtKm(Math.abs(kmLeft(v)))} km`}
              </Txt>
            </Col>
            <StatusPill status={vehicleStatus(v)} />
            <Icon name="chevR" color={c.muted2} size={20} />
          </Card>
        ))}
      </Col>
    </Box>
  );
}
