// Encabezado de un flujo por pasos: volver, contador y barra de progreso.
//
// Lo usan los tres pasos de agregar vehículo. Antes cada pantalla escribía su
// "PASO 2 / 3" a mano, así que el total vivía repetido en tres archivos y nada
// mostraba cuánto faltaba: el contador dice en cuál estás, la barra cuánto
// queda, que es lo que se mira de reojo.
import React from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Box, Col, Row, Txt, useAppColors } from '../ui';
import { IconBtn } from './primitives';
import { Icon } from './Icon';

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
        <Row ai="baseline" gap={4}>
          <Txt font="mono" fos={11} tone="muted" ls={1}>PASO</Txt>
          <Txt font="mono" fos={11} ls={1}>{`0${step}`}</Txt>
          <Txt font="monoMed" fos={11} tone="muted2" ls={1}>{`/ 0${total}`}</Txt>
        </Row>
        {/* Equilibra el botón de volver para que el contador quede centrado. */}
        <Box w={36} />
      </Row>

      <Row gap={6}>
        {Array.from({ length: total }, (_, i) => (
          <Box key={i} f={1} h={5} br="$pill" ov="hidden" bg="$line">
            {/* El relleno vive dentro de la pista y no cambia de tamaño: se
                prende y apaga con opacidad, así no hay que animar anchos. */}
            <Box
              f={1}
              transition="lazy"
              opacity={i < step ? 1 : 0}
              bg={i === step - 1 ? '$accent' : '$accent2'}
            />
          </Box>
        ))}
      </Row>
    </Col>
  );
}
