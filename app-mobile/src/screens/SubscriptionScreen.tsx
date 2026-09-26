// Suscripción — el detalle completo del plan, al que se llega desde el Menú
// (sección "Plan") y desde la card de suscripción del Perfil.
//
// Responde tres preguntas en ese orden: qué tengo contratado, cuánto llevo
// usado, y qué hay del otro lado si cambio de plan.
import React, { useCallback } from 'react';
import { Alert } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Box, Col, Row, Screen, Scroll, Txt, useAppColors } from '../ui';
import { Btn, Card, IconBtn, SectionHead } from '../components/primitives';
import { PlanHeader, UsoLista } from '../components/subscription';
import { Icon } from '../components/Icon';
import { useSuscripcion, usoDe } from '../store/suscripcion';
import type { ApiPlan, ApiSubscription } from '../api/controllers/subscriptions.controller';
import { fmtFecha } from '../utils/format';

/** La nota al pie: cuándo vence lo que tiene, dicho en una línea. */
function notaVigencia(s: ApiSubscription): string {
  if (s.status === 'expired') {
    return 'Renueva el Pro para volver a no tener topes. Lo que ya registraste no se pierde.';
  }
  if (s.plan.priceUsd === 0) return 'El plan Gratis no vence.';
  return s.expiresAt
    ? `Tu plan ${s.plan.name} está pagado hasta el ${fmtFecha(s.expiresAt)}.`
    : `Tu plan ${s.plan.name} no vence.`;
}

/** Cambiar de plan necesita el cobro, que todavía no existe. Se dice tal cual
 *  en vez de fingir que se contrató algo. */
const avisarPagoPendiente = (p: ApiPlan) =>
  Alert.alert(
    `Plan ${p.name}`,
    'Todavía no se puede cambiar de plan desde la app. Estamos habilitando el pago; te avisaremos cuando esté listo.',
  );

export function SubscriptionScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const c = useAppColors();
  const subscription = useSuscripcion((s) => s.suscripcion);
  const planes = useSuscripcion((s) => s.planes);
  const cargar = useSuscripcion((s) => s.cargar);

  useFocusEffect(
    useCallback(() => {
      void cargar();
    }, [cargar]),
  );

  const plan = subscription?.plan ?? null;
  // Los otros planes: los que se pueden contratar desde el que rige.
  const otros = plan ? planes.filter((p) => p.id !== plan.id) : [];

  return (
    <Screen>
      <Row jc="space-between" ai="center" px="$lg" pb="$md" style={{ paddingTop: insets.top + 12 }}>
        <IconBtn
          icon={<Icon name="chevL" color={c.ink} size={20} />}
          onPress={() => navigation.goBack()}
        />
        <Txt font="display" fos={18}>
          Suscripción
        </Txt>
        <Box w={36} />
      </Row>

      {/* Primera vez y sin señal: no hay plan que mostrar, y uno inventado
          sería peor que decirlo. */}
      {!subscription || !plan ? (
        <Txt fos={14} tone="muted" ta="center" px="$xl" py="$2xl">
          No pudimos cargar tu plan. Revisa tu conexión e intenta de nuevo.
        </Txt>
      ) : (
      <Scroll
        contentContainerStyle={{ paddingBottom: 48, gap: 18 }}
        showsVerticalScrollIndicator={false}
      >
        <Col gap="$sm">
          <SectionHead>Tu plan</SectionHead>
          <Box px="$lg">
            <Card>
              <PlanHeader subscription={subscription} />
            </Card>
          </Box>
        </Col>

        <Col gap="$sm">
          <SectionHead>Uso</SectionHead>
          <Box px="$lg">
            <Card>
              <UsoLista items={usoDe(subscription)} />
            </Card>
          </Box>
        </Col>

        <Col gap="$sm">
          <SectionHead>Qué incluye</SectionHead>
          <Box px="$lg">
            <Card>
              <Col gap={10}>
                {plan.features.map((f) => (
                  <Row key={f} gap="$sm" ai="center">
                    <Icon name="check" color={c.ok} size={16} />
                    <Txt f={1} fos={14}>{f}</Txt>
                  </Row>
                ))}
              </Col>
            </Card>
          </Box>
        </Col>

        {otros.map((p) => (
          <Col key={p.id} gap="$sm">
            <SectionHead>{p.priceUsd > plan.priceUsd ? 'Mejora tu plan' : 'Otro plan'}</SectionHead>
            <Box px="$lg">
              <Card>
                <Row ai="baseline" gap="$sm">
                  <Txt font="bold" fos={16}>Plan {p.name}</Txt>
                  <Txt f={1} fos={13} tone="muted">
                    {p.priceUsd === 0 ? 'sin costo' : `$${p.priceUsd} al mes`}
                  </Txt>
                </Row>

                <Col gap={10} mt="$md">
                  {p.features.map((f) => (
                    <Row key={f} gap="$sm" ai="center">
                      <Icon name="check" color={c.accent} size={16} />
                      <Txt f={1} fos={14}>{f}</Txt>
                    </Row>
                  ))}
                </Col>

                <Box mt="$lg">
                  <Btn
                    kind={p.priceUsd > plan.priceUsd ? 'primary' : 'ghost'}
                    onPress={() => avisarPagoPendiente(p)}
                  >
                    {p.priceUsd > plan.priceUsd ? `Pasar a ${p.name}` : `Cambiar a ${p.name}`}
                  </Btn>
                </Box>
              </Card>
            </Box>
          </Col>
        ))}

        <Txt fos={12} tone="muted2" ta="center" px="$xl">
          {notaVigencia(subscription)}
        </Txt>
      </Scroll>
      )}
    </Screen>
  );
}
