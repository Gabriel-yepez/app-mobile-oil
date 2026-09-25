// Leyenda de la regla de contraseña: cada regla se marca en verde en cuanto se
// cumple, mientras el usuario escribe.
//
// Lista y no un texto corrido tipo "mínimo 8, una mayúscula…": con la lista,
// el usuario ve QUÉ le falta sin releer la frase entera, y ve que va bien
// antes de enviar. Es la misma información que devuelve la API en `details`,
// adelantada.
import React from 'react';
import { Box, Col, Row, Txt } from '../ui';
import { Icon } from './Icon';
import { evaluarContrasena } from '../utils/password';

export function PasswordRules({ password }: { password: string }) {
  return (
    <Col gap={6} accessibilityRole="summary" accessibilityLabel="Requisitos de la contraseña">
      {evaluarContrasena(password).map((regla) => (
        <Row key={regla.id} ai="center" gap={8}>
          <Box
            w={16}
            h={16}
            br="$pill"
            ai="center"
            jc="center"
            bg={regla.cumple ? '$ok' : '$line'}
            transition="quick"
          >
            {regla.cumple ? <Icon name="check" color="#FFFFFF" size={11} /> : null}
          </Box>
          <Txt
            fos={12}
            tone={regla.cumple ? 'ok' : 'muted'}
            // El lector de pantalla no ve el color: dice el estado en palabras.
            accessibilityLabel={`${regla.etiqueta}: ${regla.cumple ? 'cumplido' : 'pendiente'}`}
          >
            {regla.etiqueta}
          </Txt>
        </Row>
      ))}
    </Col>
  );
}
