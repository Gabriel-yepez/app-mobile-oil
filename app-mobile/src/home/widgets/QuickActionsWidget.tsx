// Accesos rápidos. Reemplaza al FAB que se eliminó del tab bar: sin esto,
// registrar un cambio de aceite deja de tener un atajo desde el inicio.
import React from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Col, Row, Touchable, Txt, useAppColors } from '../../ui';
import { Icon, IconName } from '../../components/Icon';
import { useActiveVehicle } from '../../store/useVehicles';
import { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function QuickActionsWidget() {
  const navigation = useNavigation<Nav>();
  const c = useAppColors();
  const active = useActiveVehicle();

  const acciones: { label: string; icon: IconName; onPress: () => void }[] = [
    {
      label: 'Registrar cambio',
      icon: 'drop',
      onPress: () => active && navigation.navigate('AddOil', { vehicleId: active.id }),
    },
    {
      label: 'Agregar vehículo',
      icon: 'plus',
      onPress: () => navigation.navigate('AddVehicleType'),
    },
    {
      label: 'Historial',
      icon: 'history',
      onPress: () => navigation.navigate('History'),
    },
  ];

  return (
    <Row gap={10} px="$lg" ai="stretch">
      {acciones.map((a) => (
        <Touchable
          key={a.label}
          onPress={a.onPress}
          fade
          sink
          transition="quick"
          f={1}
          ai="center"
          gap={8}
          br="$md"
          bw={1}
          bc="$line"
          bg="$surfaceDim"
          px="$sm"
          py={14}
        >
          <Col h={36} w={36} ai="center" jc="center" br={10} bg="transparent">
            <Icon name={a.icon} color={c.accent} size={18} />
          </Col>
          <Txt font="semi" fos={11} ta="center" tone="ink2">
            {a.label}
          </Txt>
        </Touchable>
      ))}
    </Row>
  );
}
