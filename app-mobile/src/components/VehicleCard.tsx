// La tarjeta del vehículo en el garaje.
//
// Vive aparte de VehiclesScreen porque el selector de color la usa como vista
// previa: al ser el mismo componente, lo que el usuario ve al elegir el color
// es exactamente lo que después va a ver en su garaje.
import React from 'react';
import { Box, Col, Row, Txt, useAppColors } from '../ui';
import { Card, StatusPill, VehicleThumb } from './primitives';
import { Icon } from './Icon';
import { fmtKm } from '../utils/format';
import type { ApiVehicle } from '../api/controllers/vehicles.controller';

export type VehiculoTarjeta = Pick<ApiVehicle, 'kind' | 'color' | 'brand' | 'model' | 'plate' | 'year'> &
  Partial<Pick<ApiVehicle, 'gauge' | 'odometer'>>;

export function VehicleCard({
  vehiculo: v,
  aviso,
}: {
  vehiculo: VehiculoTarjeta;
  /** Texto en rojo bajo la placa: un rechazo del servidor al sincronizar. */
  aviso?: string;
}) {
  const c = useAppColors();
  // El estado lo calcula el backend y viaja con la lista: una sola
  // definición para toda la app, en vez de una por pantalla.
  const pct = v.gauge?.pct ?? 0;
  const status = v.gauge?.status ?? 'ok';
  const accent = status === 'ok' ? c.ok : status === 'warn' ? c.warn : c.danger;

  return (
    <Card>
      <Row gap={14}>
        <VehicleThumb kind={v.kind} color={v.color} size={56} />
        <Col f={1}>
          <Row mb={4} gap="$sm">
            <Box br={4} bw={1} bc="$line" px={6} py={2}>
              <Txt font="monoMed" fos={10} tone="muted" ls={0.5}>
                {v.kind === 'car' ? 'CARRO' : 'MOTO'}
              </Txt>
            </Box>
            {v.gauge ? <StatusPill status={status} /> : null}
          </Row>
          <Txt font="bold" fos={16} ls={-0.2} numberOfLines={1}>
            {v.brand} {v.model}
          </Txt>
          <Txt font="monoMed" fos={12} tone="muted" mt={1}>
            {v.plate} · {v.year}
            {v.odometer
              ? ` · ${v.odometer.source === 'estimated' ? '~' : ''}${fmtKm(v.odometer.km)} km`
              : ''}
          </Txt>
          {aviso ? (
            <Txt fos={11} tone="danger" mt={2}>
              {aviso}
            </Txt>
          ) : null}
        </Col>
        <Icon name="chevR" color={c.muted2} size={22} />
      </Row>

      {/* mini progress — solo si el vehículo ya tiene un ciclo */}
      {v.gauge ? (
        <Row mt={14} gap={10}>
          <Box h={6} f={1} ov="hidden" br={3} bg="$bg2">
            <Box
              h="100%"
              br={3}
              bg={accent}
              width={`${Math.max(4, Math.min(100, pct))}%`}
              transition="gauge"
              enterStyle={{ width: '0%' }}
            />
          </Box>
          <Txt font="mono" fos={12} minWidth={88} ta="right">
            {fmtKm(v.gauge.kmLeft)} <Txt fos={12} tone="muted">km</Txt>
          </Txt>
        </Row>
      ) : (
        <Txt fos={12} tone="muted" mt={12}>
          Registra el primer cambio para activar el medidor
        </Txt>
      )}
    </Card>
  );
}
