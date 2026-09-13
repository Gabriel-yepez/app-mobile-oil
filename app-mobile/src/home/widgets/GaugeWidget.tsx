// Gauge de vida del aceite del vehículo activo. Tocar → registrar un cambio.
import React from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Touchable } from '../../ui';
import { OilGauge } from '../../components/OilGauge';
import { kmLeft, oilPct, useActiveVehicle } from '../../store/useStore';
import { RootStackParamList } from '../../navigation/types';
import { DarkWidgetSurface } from '../DarkWidgetSurface';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function GaugeWidget() {
  const navigation = useNavigation<Nav>();
  const active = useActiveVehicle();

  return (
    <DarkWidgetSurface>
      <Touchable
        fade
        ai="center"
        onPress={() => navigation.navigate('AddOil', { vehicleId: active.id })}
      >
        <OilGauge pct={oilPct(active)} kmLeft={kmLeft(active)} size={220} />
      </Touchable>
    </DarkWidgetSurface>
  );
}
