// Alertas — agrupadas por estado: crítica (vencido), warning (próximo) y resueltas
import React from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Box, Col, Row, Scroll, Txt, useAppColors, useIsDark, useShadows } from '../ui';
import { Btn, Card, IconBtn, SectionHead } from '../components/primitives';
import { Icon } from '../components/Icon';
import { fmtKm } from '../utils/format';
import { kmLeft, useStore, vehicleStatus } from '../store/useStore';
import { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// Resueltas (mock estático — vendrá del backend)
const RESOLVED = [
  { v: 'Bera BR-200', text: 'Cambio realizado el 14 ene · 17.000 km', date: 'hace 26d' },
  { v: 'Toyota Corolla', text: 'Cambio realizado el 21 oct · 67.800 km', date: 'hace 110d' },
];

export function AlertsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const c = useAppColors();
  const sh = useShadows();
  const isDark = useIsDark();
  const vehicles = useStore((s) => s.vehicles);

  const overdue = vehicles.filter((v) => vehicleStatus(v) === 'danger');
  const soon = vehicles.filter((v) => vehicleStatus(v) === 'warn');
  const open = overdue.length + soon.length;

  // En claro el ámbar oscuro del handoff; en oscuro sería ilegible, así que
  // usamos el propio token de warn, ya aclarado para fondos oscuros.
  const warnInk = isDark ? c.warn : '#B45309';

  return (
    <Box f={1} bg="$bg3">
      {/* top bar */}
      <Row jc="space-between" px="$xl" pb={14} pt={insets.top + 12}>
        <Col>
          <Txt fos={12} tone="muted" ls={1} caps>
            Alertas
          </Txt>
          <Txt font="display" fos={26} ls={-0.5}>
            {open} abiertas
          </Txt>
        </Col>
        <IconBtn icon={<Icon name="settings" color={c.ink} size={20} />} size={40} />
      </Row>

      <Scroll
        bg="$bg3"
        contentContainerStyle={{ gap: 12, paddingHorizontal: 16, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* críticas: vencido */}
        {overdue.map((v) => (
          <Box
            key={v.id}
            ov="hidden"
            br="$lg"
            bw={1.5}
            bc={isDark ? 'rgba(248,113,113,0.28)' : 'rgba(239,68,68,0.2)'}
            style={sh.card}
            transition="bouncy"
            enterStyle={{ opacity: 0, y: 12 }}
          >
            <LinearGradient colors={[c.dangerSoft, c.surface]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 16 }}>
              <Row mb={10} gap={10}>
                <Box h={36} w={36} ai="center" jc="center" br={10} bg="$danger">
                  <Icon name="bell" color="#fff" size={20} />
                </Box>
                <Col f={1}>
                  <Txt font="bold" fos={11} tone="danger" ls={1.2} caps>
                    Cambio vencido
                  </Txt>
                  <Txt font="display" fos={17}>
                    {v.brand} {v.model}
                  </Txt>
                </Col>
              </Row>
              <Txt fos={13} lh={19.5} tone="muted">
                Has superado el kilometraje recomendado. Excedido por{' '}
                <Txt font="mono" fos={13} tone="danger">+{fmtKm(Math.abs(kmLeft(v)))} km</Txt>.
              </Txt>
              <Row mt="$md" gap="$sm">
                <Btn
                  kind="primary"
                  size="sm"
                  style={{ flex: 1, backgroundColor: c.danger }}
                  onPress={() => navigation.navigate('AddOil', { vehicleId: v.id })}
                >
                  Registrar cambio
                </Btn>
                <Btn kind="ghost" size="sm" style={{ flex: 1 }}>
                  Posponer
                </Btn>
              </Row>
            </LinearGradient>
          </Box>
        ))}

        {/* warning: próximo */}
        {soon.map((v) => (
          <Box
            key={v.id}
            ov="hidden"
            br="$lg"
            bw={1.5}
            bc={isDark ? 'rgba(251,191,36,0.28)' : 'rgba(245,158,11,0.2)'}
            style={sh.card}
            transition="bouncy"
            enterStyle={{ opacity: 0, y: 12 }}
          >
            <LinearGradient colors={[c.warnSoft, c.surface]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 16 }}>
              <Row mb={10} gap={10}>
                <Box h={36} w={36} ai="center" jc="center" br={10} bg="$warn">
                  <Icon name="gauge" color="#fff" size={20} />
                </Box>
                <Col f={1}>
                  <Txt font="bold" fos={11} ls={1.2} caps col={warnInk}>
                    Próximo cambio
                  </Txt>
                  <Txt font="display" fos={17}>
                    {v.brand} {v.model}
                  </Txt>
                </Col>
              </Row>
              <Txt fos={13} lh={19.5} tone="muted">
                Restan <Txt font="mono" fos={13} col={warnInk}>{fmtKm(kmLeft(v))} km</Txt> para el próximo
                cambio. Programa tu visita al lubricentro.
              </Txt>
            </LinearGradient>
          </Box>
        ))}

        {/* resueltas */}
        <Box mx={-16} mt="$sm">
          <SectionHead>Resueltas</SectionHead>
        </Box>
        {RESOLVED.map((r, i) => (
          <Card key={i} fd="row" ai="center" gap="$md">
            <Box h={32} w={32} ai="center" jc="center" br={10} bg="$okSoft">
              <Icon name="check" color={c.ok} size={18} />
            </Box>
            <Col f={1}>
              <Txt font="bold" fos={14}>{r.v}</Txt>
              <Txt fos={12} tone="muted" mt={1}>{r.text}</Txt>
            </Col>
            <Txt font="monoMed" fos={11} tone="muted2">{r.date}</Txt>
          </Card>
        ))}
      </Scroll>
    </Box>
  );
}
