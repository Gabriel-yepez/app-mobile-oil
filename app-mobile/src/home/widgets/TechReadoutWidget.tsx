// Lectura técnica del vehículo activo: odómetro, próximo cambio y aceite.
import React from 'react';
import { Col, Row, Txt } from '../../ui';
import { fmtKm } from '../../utils/format';
import { useActiveVehicle } from '../../store/useStore';
import { DarkWidgetSurface } from '../DarkWidgetSurface';

export function TechReadoutWidget() {
  const active = useActiveVehicle();

  const filas = [
    { l: 'Odómetro', v: fmtKm(active.km), u: 'km' },
    { l: 'Próximo', v: fmtKm(active.nextChange), u: 'km' },
    { l: 'Aceite', v: active.oil.viscosity, u: active.oil.brand },
  ];

  return (
    <DarkWidgetSurface>
      <Row ai="stretch">
        {filas.map((r) => (
          <Col key={r.l} f={1} ai="center">
            <Txt font="bold" fos={9} col="rgba(255,255,255,0.55)" ls={1.2} caps>
              {r.l}
            </Txt>
            <Txt font="mono" fos={16} tone="onDark" mt={2}>{r.v}</Txt>
            <Txt fos={10} col="rgba(255,255,255,0.55)">{r.u}</Txt>
          </Col>
        ))}
      </Row>
    </DarkWidgetSurface>
  );
}
