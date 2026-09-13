// Suscripción — el detalle completo del plan, al que se llega desde el Menú
// (sección "Plan") y desde la card de suscripción del Perfil.
//
// Responde tres preguntas en ese orden: qué tengo contratado, cuánto llevo
// usado, y qué hay del otro lado si cambio de plan.
import React from 'react';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Box, Col, Row, Screen, Scroll, Txt, useAppColors } from '../ui';
import { Btn, Card, IconBtn, SectionHead } from '../components/primitives';
import { PlanHeader, UsoLista } from '../components/subscription';
import { Icon } from '../components/Icon';
import { PLAN_LIST } from '../data/mock';
import { usePlan, usePlanUsage, useStore } from '../store/useStore';

export function SubscriptionScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const c = useAppColors();
  const subscription = useStore((s) => s.subscription);
  const plan = usePlan();
  const uso = usePlanUsage();

  // Los otros planes: los que se pueden contratar desde el actual.
  const otros = PLAN_LIST.filter((p) => p.id !== plan.id);

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

      <Scroll
        contentContainerStyle={{ paddingBottom: 48, gap: 18 }}
        showsVerticalScrollIndicator={false}
      >
        <Col gap="$sm">
          <SectionHead>Tu plan</SectionHead>
          <Box px="$lg">
            <Card>
              <PlanHeader plan={plan} subscription={subscription} />
            </Card>
          </Box>
        </Col>

        <Col gap="$sm">
          <SectionHead>Uso</SectionHead>
          <Box px="$lg">
            <Card>
              <UsoLista items={uso} />
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
            <SectionHead>{p.priceUsd > plan.priceUsd ? 'Mejorá tu plan' : 'Otro plan'}</SectionHead>
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
                  {/* El cobro necesita backend: por ahora el botón deja el rastro
                      en consola en vez de fingir que contrató algo. */}
                  <Btn
                    kind={p.priceUsd > plan.priceUsd ? 'primary' : 'ghost'}
                    onPress={() => console.log(`Cambiar al plan ${p.id} (falta backend de pagos)`)}
                  >
                    {p.priceUsd > plan.priceUsd ? `Pasar a ${p.name}` : `Cambiar a ${p.name}`}
                  </Btn>
                </Box>
              </Card>
            </Box>
          </Col>
        ))}

        <Txt fos={12} tone="muted2" ta="center" px="$xl">
          {plan.priceUsd === 0
            ? 'El plan Gratis no vence.'
            : `Tu plan se renueva solo el ${subscription.renewsOn}.`}
        </Txt>
      </Scroll>
    </Screen>
  );
}
