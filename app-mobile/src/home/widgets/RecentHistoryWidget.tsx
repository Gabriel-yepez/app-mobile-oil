// Los tres cambios de aceite más recientes de toda la flota.
import React from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Box, Col, Touchable, Txt, useAppColors } from '../../ui';
import { Card, SectionHead } from '../../components/primitives';
import { Icon } from '../../components/Icon';
import { fmtKm, fmtUsd } from '../../utils/format';
import { useVehicles } from '../../store/useVehicles';
import { useAllOilChanges } from '../../hooks/useAllOilChanges';
import { fmtFecha } from '../../utils/format';
import { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function RecentHistoryWidget() {
  const navigation = useNavigation<Nav>();
  const c = useAppColors();
  const vehicles = useVehicles((s) => s.vehicles);
  const { items: changes } = useAllOilChanges(3);

  const recent = changes.slice(0, 3);
  const vehicleName = (id: string) => {
    const v = vehicles.find((x) => x.id === id);
    return v ? `${v.brand} ${v.model.split(' ')[0]}` : '';
  };

  return (
    <Box>
      <SectionHead
        right={
          <Touchable onPress={() => navigation.navigate('History')} hitSlop={8} fade>
            <Txt font="semi" fos={12} tone="accent">Ver todo</Txt>
          </Touchable>
        }
      >
        Historial reciente
      </SectionHead>
      <Col gap={10} px="$lg">
        {recent.map((h) => (
          <Card key={h.id} fd="row" ai="center" gap="$md">
            <Box h={36} w={36} ai="center" jc="center" br={10} bg="$accentSoft">
              <Icon name="drop" color={c.accent} size={18} />
            </Box>
            <Col f={1}>
              <Txt font="bold" fos={14}>{vehicleName(h.vehicleId)}</Txt>
              <Txt fos={12} tone="muted" mt={1}>
                {fmtFecha(h.changedAt)} · <Txt font="monoMed" fos={12} tone="muted">{fmtKm(h.km)}</Txt> km · {h.oilBrand} {h.oilViscosity}
              </Txt>
            </Col>
            <Col ai="flex-end">
              <Txt font="mono" fos={14}>{fmtUsd(h.costUsd ?? 0)}</Txt>
              <Txt fos={10} tone="muted2">USD</Txt>
            </Col>
          </Card>
        ))}
      </Col>
    </Box>
  );
}
