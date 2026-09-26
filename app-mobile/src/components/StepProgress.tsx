// Las dos mitades de un indicador de pasos: el contador ("PASO 02 / 03") y las
// barras de progreso.
//
// Van separadas y no en un solo componente porque sus dos consumidores las
// disponen distinto: StepHeader centra el contador en la fila del botón de
// volver y pone las barras a lo ancho debajo, mientras que el registro las
// apila dentro del hero navy. Un componente que impusiera la disposición
// obligaría a uno de los dos a no usarlo.
//
// Lo que sí comparten —y es lo que de verdad se duplicaba— son los colores,
// los grosores y la lógica de qué barra va encendida.
import React from 'react';
import { Box, Row, Txt } from '../ui';

type Props = {
  /** Paso actual, contando desde 1. */
  step: number;
  total: number;
  /** Sobre el hero navy: los tonos de tema no rinden ahí. */
  onDark?: boolean;
};

export function StepCounter({ step, total, onDark = false }: Props) {
  return (
    <Row ai="baseline" gap={4}>
      <Txt font="mono" fos={11} tone={onDark ? 'onDarkMuted' : 'muted'} ls={1}>
        PASO
      </Txt>
      <Txt font="mono" fos={11} tone={onDark ? 'onDark' : 'ink'} ls={1}>
        {`0${step}`}
      </Txt>
      <Txt font="monoMed" fos={11} tone={onDark ? 'onDarkMuted' : 'muted2'} ls={1}>
        {`/ 0${total}`}
      </Txt>
    </Row>
  );
}

export function StepBars({ step, total, onDark = false }: Props) {
  const pista = onDark ? 'rgba(255,255,255,0.22)' : '$line';
  const activo = onDark ? '#FFFFFF' : '$accent';
  const previo = onDark ? 'rgba(255,255,255,0.55)' : '$accent2';

  return (
    <Row gap={6}>
      {Array.from({ length: total }, (_, i) => (
        <Box key={i} f={1} h={5} br="$pill" ov="hidden" bg={pista}>
          {/* El relleno vive dentro de la pista y no cambia de tamaño: se
              prende y apaga con opacidad, así no hay que animar anchos. */}
          <Box
            f={1}
            transition="lazy"
            opacity={i < step ? 1 : 0}
            bg={i === step - 1 ? activo : previo}
          />
        </Box>
      ))}
    </Row>
  );
}
