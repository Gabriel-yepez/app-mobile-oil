// El estado del aceite en UNA tarjeta: medidor arriba, y la fila de odómetro /
// próximo / aceite abajo, separadas por una línea.
//
// Eran dos widgets (GaugeWidget y TechReadoutWidget) alimentados por selectores
// locales distintos. Ahora los cuatro números salen del mismo bloque del
// backend: no hay forma de que la barra diga una cosa y la fila otra.
import React from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Box, Col, Row, Touchable, Txt } from '../../ui';
import { OilGauge } from '../../components/OilGauge';
import { fmtKm } from '../../utils/format';
import { useActiveVehicle } from '../../store/useVehicles';
import { useOilStatus } from '../../hooks/useOilStatus';
import { RootStackParamList } from '../../navigation/types';
import { DarkWidgetSurface } from '../DarkWidgetSurface';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function OilStatusWidget() {
  const navigation = useNavigation<Nav>();
  const active = useActiveVehicle();
  const { data, viejo, horasDeAntiguedad } = useOilStatus(active?.id ?? null);

  if (!active) {
    return (
      <DarkWidgetSurface>
        <Txt fos={13} col="rgba(255,255,255,0.6)" ta="center">
          Agrega un vehículo para empezar
        </Txt>
      </DarkWidgetSurface>
    );
  }

  // Sin ciclo no hay nada que medir: se pide el primer cambio en vez de
  // dibujar un medidor vacío que parecería un aceite agotado.
  if (!data?.gauge) {
    return (
      <DarkWidgetSurface>
        <Touchable
          fade
          ai="center"
          onPress={() => navigation.navigate('AddOil', { vehicleId: active.id })}
        >
          <Txt fos={13} col="rgba(255,255,255,0.6)" ta="center">
            Registra tu primer cambio para activar el medidor
          </Txt>
        </Touchable>
      </DarkWidgetSurface>
    );
  }

  const { gauge, odometer, cycle, oil } = data;
  const estimado = odometer?.source === 'estimated';

  const filas = [
    {
      l: 'Odómetro',
      // La tilde marca que es una proyección y no una lectura. Tocarla abre
      // el input: no le exigimos el dato, pero le dejamos la puerta abierta
      // para el día que sí mire el tablero.
      v: `${estimado ? '~' : ''}${fmtKm(odometer?.km ?? 0)}`,
      u: estimado ? 'km · tocar' : 'km',
      onPress: () =>
        navigation.navigate('ReportOdometer', { vehicleId: active.id }),
    },
    { l: 'Próximo', v: fmtKm(cycle?.nextChangeKm ?? 0), u: 'km' },
    { l: 'Aceite', v: oil?.viscosity ?? '—', u: oil?.brand ?? '' },
  ];

  return (
    <DarkWidgetSurface>
      <Touchable
        fade
        ai="center"
        onPress={() => navigation.navigate('AddOil', { vehicleId: active.id })}
      >
        <OilGauge
          pct={gauge.pct}
          status={gauge.status}
          limitedBy={gauge.limitedBy}
          kmLeft={gauge.kmLeft}
          daysLeft={gauge.daysLeft}
          size={220}
        />
      </Touchable>

      {/* Sin señal el bloque envejece: se dice, en vez de mostrar el número
          como si fuera de ahora. No se recalcula en el cliente — eso sería
          volver a tener dos implementaciones de la misma fórmula. */}
      {viejo ? (
        <Txt fos={11} col="rgba(255,255,255,0.45)" mt={6} ta="center">
          Calculado hace {Math.floor(horasDeAntiguedad / 24)} días
        </Txt>
      ) : null}

      {/* La línea que hace que sean dos zonas de una tarjeta, no dos tarjetas */}
      <Box h={1} bg="rgba(255,255,255,0.08)" my="$md" />

      <Row ai="stretch">
        {filas.map((r) => (
          <Touchable
            key={r.l}
            f={1}
            ai="center"
            fade
            disabled={!r.onPress}
            onPress={r.onPress}
          >
            <Col ai="center">
              <Txt font="bold" fos={9} col="rgba(255,255,255,0.55)" ls={1.2} caps>
                {r.l}
              </Txt>
              <Txt font="mono" fos={16} tone="onDark" mt={2}>
                {r.v}
              </Txt>
              <Txt fos={10} col="rgba(255,255,255,0.55)">
                {r.u}
              </Txt>
            </Col>
          </Touchable>
        ))}
      </Row>
    </DarkWidgetSurface>
  );
}
