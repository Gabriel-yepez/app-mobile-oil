// Piezas de la suscripción que comparten el perfil y la pantalla de plan.
//
// Viven acá y no en cada pantalla porque el resumen del perfil y el detalle del
// plan muestran lo mismo con distinto tamaño: si el estado o el texto del uso se
// escriben dos veces, tarde o temprano dicen cosas distintas.
import React from 'react';
import { Box, Col, Row, Txt, useAppColors } from '../ui';
import { Icon } from './Icon';
import type { ApiSubscription } from '../api/controllers/subscriptions.controller';
import type { Uso } from '../store/suscripcion';
import { fmtFecha } from '../utils/format';

export const ESTADO_SUSCRIPCION = {
  active: { label: 'Activa', tone: 'ok' },
  expired: { label: 'Vencida', tone: 'danger' },
} as const;

/** La línea de precio y vigencia bajo el nombre del plan. */
export function vigenciaTexto(s: ApiSubscription): string {
  // Vencido: el título ya dice el plan que rige (el gratis); esto explica por qué.
  if (s.status === 'expired') {
    return `Tu Pro venció${s.expiresAt ? ` el ${fmtFecha(s.expiresAt)}` : ''} · rigen los topes del Gratis`;
  }
  if (s.plan.priceUsd === 0) return 'Sin costo';
  const precio = `$${s.plan.priceUsd} al mes`;
  return s.expiresAt ? `${precio} · pagado hasta el ${fmtFecha(s.expiresAt)}` : precio;
}

/** Texto del uso contra el tope. `null` en el tope es "sin límite", no cero: el
 *  plan pago no muestra un contador que nunca se va a llenar. */
export function usoTexto(usado: number, tope: number | null) {
  return tope === null ? `${usado} · sin tope` : `${usado} de ${tope}`;
}

/** Barra de consumo. Se acota a 100 para que pasarse del tope (algo que puede
 *  pasar si el plan baja de categoría) no dibuje una barra fuera de la caja. */
export function Medidor({ usado, tope }: { usado: number; tope: number | null }) {
  const c = useAppColors();
  if (tope === null) return null;

  const pct = Math.min(100, Math.round((usado / tope) * 100));
  return (
    <Box h={6} f={1} ov="hidden" br={3} bg="$bg2">
      <Box
        h="100%"
        br={3}
        bg={pct >= 100 ? c.danger : pct >= 80 ? c.warn : c.accent}
        width={`${Math.max(4, pct)}%`}
        transition="gauge"
        enterStyle={{ width: '0%' }}
      />
    </Box>
  );
}

/** Encabezado del plan: qué se tiene contratado y en qué estado. */
export function PlanHeader({ subscription }: { subscription: ApiSubscription }) {
  const c = useAppColors();
  const { plan } = subscription;
  const estado = ESTADO_SUSCRIPCION[subscription.status];

  return (
    <Row ai="center" gap="$md">
      <Box h={40} w={40} ai="center" jc="center" br={12} bg="$accentSoft">
        <Icon name="spark" color={c.accent} size={20} />
      </Box>
      <Col f={1}>
        <Txt font="bold" fos={16}>Plan {plan.name}</Txt>
        <Txt fos={12} tone="muted" mt={1}>
          {vigenciaTexto(subscription)}
        </Txt>
      </Col>
      <Row gap={6} ai="center" br="$pill" bg="$bg2" px="$sm" py={4}>
        <Box h={6} w={6} br="$pill" bg={`$${estado.tone}`} />
        <Txt font="semi" fos={11} tone="muted">{estado.label}</Txt>
      </Row>
    </Row>
  );
}

/** Lista de medidores de consumo. */
export function UsoLista({ items }: { items: Uso[] }) {
  return (
    <Col gap="$md">
      {items.map((u) => (
        <Col key={u.k} gap={6}>
          <Row jc="space-between" ai="baseline">
            <Txt fos={13} tone="muted">{u.k}</Txt>
            <Txt font="monoMed" fos={13}>{usoTexto(u.usado, u.tope)}</Txt>
          </Row>
          <Medidor usado={u.usado} tope={u.tope} />
        </Col>
      ))}
    </Col>
  );
}
