// Encabezado de un flujo por pasos: volver, contador y barra de progreso.
//
// Lo usan los tres pasos de agregar vehículo. Antes cada pantalla escribía su
// "PASO 2 / 3" a mano, así que el total vivía repetido en tres archivos y nada
// mostraba cuánto faltaba: el contador dice en cuál estás, la barra cuánto
// queda, que es lo que se mira de reojo.
//
// El contador y las barras viven en StepProgress, porque el registro necesita
// esas dos piezas con otra disposición: dentro del hero navy, que ya trae su
// propio botón de volver.
import React from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Box, Col, Row, useAppColors } from '../ui';
import { IconBtn } from './primitives';
import { Icon } from './Icon';
import { StepBars, StepCounter } from './StepProgress';

export function StepHeader({
  step,
  total,
  onBack,
}: {
  /** Paso actual, contando desde 1. */
  step: number;
  total: number;
  onBack: () => void;
}) {
  const insets = useSafeAreaInsets();
  const c = useAppColors();

  return (
    <Col px="$xl" pt={insets.top + 12} gap={12}>
      <Row jc="space-between" ai="center">
        <IconBtn icon={<Icon name="chevL" color={c.ink} size={20} />} onPress={onBack} />
        <StepCounter step={step} total={total} />
        {/* Equilibra el botón de volver para que el contador quede centrado. */}
        <Box w={36} />
      </Row>

      <StepBars step={step} total={total} />
    </Col>
  );
}
