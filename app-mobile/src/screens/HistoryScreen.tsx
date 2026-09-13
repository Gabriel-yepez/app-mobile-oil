// Historial completo — resumen de inversión USD/Bs.S + lista de todos los cambios
import React from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Box, Col, Row, Scroll, Txt, useAppColors } from '../ui';
import { radius } from '../theme';
import { Card, IconBtn, VehicleThumb } from '../components/primitives';
import { Icon } from '../components/Icon';
import { fmtKm, fmtUsd } from '../utils/format';
import { BS_RATE, SPEND_BARS } from '../data/mock';
import { useStore } from '../store/useStore';

export function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const c = useAppColors();
  const changes = useStore((s) => s.changes);
  const vehicles = useStore((s) => s.vehicles);

  const totalUsd = changes.reduce((sum, ch) => sum + ch.costUsd, 0);
  const maxBar = Math.max(...SPEND_BARS);
  const vehicleOf = (id: string) => vehicles.find((v) => v.id === id);

  return (
    <Box f={1} bg="$bg3">
      {/* top bar */}
      <Row jc="space-between" px="$xl" pb={14} pt={insets.top + 12}>
        <Row gap="$md">
          {navigation.canGoBack() ? (
            <IconBtn icon={<Icon name="chevL" color={c.ink} size={20} />} onPress={() => navigation.goBack()} />
          ) : null}
          <Col>
            <Txt fos={12} tone="muted" ls={1} caps>
              Historial
            </Txt>
            <Txt font="display" fos={26} ls={-0.5}>
              {changes.length} cambios
            </Txt>
          </Col>
        </Row>
        <IconBtn icon={<Icon name="search" color={c.ink} size={20} />} size={40} />
      </Row>

      <Scroll bg="$bg3" contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        {/* inversión */}
        <Box px="$lg" pb={14}>
          <LinearGradient
            colors={[c.primary, c.primary2]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ borderRadius: radius.lg, padding: 16 }}
          >
            <Txt font="bold" fos={11} tone="onDarkMuted" ls={1.2} caps>
              Inversión 2026
            </Txt>
            <Row ai="baseline" gap="$sm" mt={6}>
              <Txt font="mono" fos={32} tone="onDark" ls={-1}>{fmtUsd(totalUsd)}</Txt>
              <Txt fos={12} tone="onDarkSoft">
                USD · ≈ Bs.S {fmtKm(totalUsd * BS_RATE)}
              </Txt>
            </Row>

            {/* mini bar chart */}
            <Row mt={14} h={50} ai="flex-end" gap={6}>
              {SPEND_BARS.map((h, i) => (
                <Box
                  key={i}
                  f={1}
                  br={3}
                  bg={i === SPEND_BARS.length - 1 ? '$accent2' : 'rgba(255,255,255,0.18)'}
                  height={`${(h / maxBar) * 100}%`}
                  transition="gauge"
                  enterStyle={{ height: 0 }}
                />
              ))}
            </Row>
            <Row mt={6} jc="space-between">
              {['ENE', 'ABR', 'JUL', 'OCT', 'DIC'].map((m) => (
                <Txt key={m} font="monoMed" fos={10} tone="onDarkMuted">
                  {m}
                </Txt>
              ))}
            </Row>
          </LinearGradient>
        </Box>

        {/* lista */}
        <Col gap={10} px="$lg">
          {changes.map((h) => {
            const v = vehicleOf(h.vehicleId);
            return (
              <Card key={h.id} fd="row" ai="center" gap="$md">
                <VehicleThumb kind={v?.kind ?? 'car'} color={v?.color ?? '#1F2937'} size={42} />
                <Col f={1}>
                  <Txt font="bold" fos={14} ls={-0.1}>
                    {v ? `${v.brand} ${v.model}` : 'Vehículo'}
                  </Txt>
                  <Txt fos={12} tone="muted" mt={1}>
                    <Txt font="monoMed" fos={12} tone="muted">{h.date}</Txt> ·{' '}
                    <Txt font="monoMed" fos={12} tone="muted">{fmtKm(h.km)}</Txt> km
                  </Txt>
                  <Txt fos={12} tone="muted2" mt={1}>
                    {h.oil.brand} {h.oil.tag} {h.oil.viscosity}
                  </Txt>
                </Col>
                <Col ai="flex-end">
                  <Txt font="mono" fos={14}>{fmtUsd(h.costUsd)}</Txt>
                  <Txt fos={10} tone="muted2">USD</Txt>
                </Col>
              </Card>
            );
          })}
        </Col>
      </Scroll>
    </Box>
  );
}
