// Alertas — agrupadas por estado: crítica (vencido), warning (próximo),
// pospuestas y resueltas
import React from 'react';
import { Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Box, Col, Row, Scroll, Txt, useAppColors, useIsDark, useShadows } from '../ui';
import { Btn, Card, IconBtn, SectionHead } from '../components/primitives';
import { Icon } from '../components/Icon';
import { fmtFecha, fmtHace, fmtKm } from '../utils/format';
import { alertaPospuesta, useVehicles } from '../store/useVehicles';
import type { ApiVehicle } from '../api/controllers/vehicles.controller';
import { useAllOilChanges } from '../hooks/useAllOilChanges';
import { toast } from '../store/toast';
import { textoDeError } from '../utils/errores';
import { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/** Cuántas resueltas se listan. Es un recordatorio de lo último que se
 *  atendió, no el historial: para eso está la pantalla de Historial. */
const MAX_RESUELTAS = 5;

/** Los plazos que ofrece "Posponer". El backend acepta de 1 a 30 días; más
 *  que una semana ya no es posponer, es apagar el aviso, y eso vive en los
 *  ajustes de notificaciones. */
const PLAZOS = [
  { label: '1 día', dias: 1 },
  { label: '3 días', dias: 3 },
  { label: '1 semana', dias: 7 },
];

const DIA_MS = 86_400_000;

/** "vuelve en 3 días". Redondea hacia arriba: con 20 horas por delante,
 *  "0 días" se leería como que ya volvió. */
const vuelveEn = (hasta: string, ahora: Date) => {
  const dias = Math.max(1, Math.ceil((new Date(hasta).getTime() - ahora.getTime()) / DIA_MS));
  return `vuelve en ${dias} ${dias === 1 ? 'día' : 'días'}`;
};

export function AlertsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const c = useAppColors();
  const sh = useShadows();
  const isDark = useIsDark();
  const vehicles = useVehicles((s) => s.vehicles);
  const posponerAlerta = useVehicles((s) => s.posponerAlerta);
  const reactivarAlerta = useVehicles((s) => s.reactivarAlerta);
  // Resueltas: los cambios que se hicieron CON una alerta encima. Un cambio
  // adelantado no atendió ninguna y no aparece; eso lo decide el backend en
  // `resolvedAlert`, recalculando el estado del aceite al momento del cambio.
  const { items: cambios } = useAllOilChanges();
  const resueltas = cambios.filter((ch) => ch.resolvedAlert !== null).slice(0, MAX_RESUELTAS);
  const vehicleOf = (id: string) => vehicles.find((v) => v.id === id);

  const ahora = new Date();
  const conAlerta = vehicles.filter((v) => v.gauge !== null && v.gauge.status !== 'ok');
  const pospuestas = conAlerta.filter((v) => alertaPospuesta(v, ahora));
  const vivas = conAlerta.filter((v) => !alertaPospuesta(v, ahora));
  const overdue = vivas.filter((v) => v.gauge?.status === 'danger');
  const soon = vivas.filter((v) => v.gauge?.status === 'warn');
  const open = overdue.length + soon.length;

  const posponer = (v: ApiVehicle) => {
    const elegir = async (dias: number, label: string) => {
      try {
        await posponerAlerta(v.id, dias);
        toast.ok(`Alerta de ${v.brand} ${v.model} pospuesta ${label}.`);
      } catch (e) {
        // El store ya la devolvió a abiertas: solo falta decir por qué.
        toast.error(textoDeError(e));
      }
    };
    Alert.alert(
      'Posponer alerta',
      `No te avisaremos de ${v.brand} ${v.model} durante este tiempo. Si registras el cambio antes, la alerta se cierra sola.`,
      [
        ...PLAZOS.map((p) => ({ text: p.label, onPress: () => void elegir(p.dias, p.label) })),
        { text: 'Cancelar', style: 'cancel' as const },
      ],
    );
  };

  const reactivar = async (v: ApiVehicle) => {
    try {
      await reactivarAlerta(v.id);
    } catch (e) {
      toast.error(textoDeError(e));
    }
  };

  // En claro el ámbar oscuro del handoff; en oscuro sería ilegible, así que
  // usamos el propio token de warn, ya aclarado para fondos oscuros.
  const warnInk = isDark ? c.warn : '#B45309';

  return (
    <Box f={1} bg="$bg3">
      {/* top bar */}
      <Row jc="space-between" px="$xl" pb={14} pt={insets.top + 12}>
        {/* Alertas dejó de ser un tab: ahora se empuja sobre el stack, así que
            necesita su propia salida. El gesto de borde de iOS no alcanza —
            en Android no existe y la pantalla quedaría sin retorno visible. */}
        <Row f={1} ai="center" gap="$md">
          <IconBtn
            icon={<Icon name="chevL" color={c.ink} size={22} />}
            size={40}
            onPress={() => navigation.goBack()}
          />
          <Col f={1}>
            <Txt fos={12} tone="muted" ls={1} caps>
              Alertas
            </Txt>
            <Txt font="display" fos={26} ls={-0.5}>
              {open} abiertas
            </Txt>
          </Col>
        </Row>
        <IconBtn
          icon={<Icon name="settings" color={c.ink} size={20} />}
          size={40}
          onPress={() => navigation.navigate('Notifications')}
        />
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
                <Txt font="mono" fos={13} tone="danger">+{fmtKm(Math.abs(v.gauge?.kmLeft ?? 0))} km</Txt>.
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
                <Btn kind="ghost" size="sm" style={{ flex: 1 }} onPress={() => posponer(v)}>
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
                Restan <Txt font="mono" fos={13} col={warnInk}>{fmtKm(v.gauge?.kmLeft ?? 0)} km</Txt> para el próximo
                cambio. Programa tu visita al lubricentro.
              </Txt>
            </LinearGradient>
          </Box>
        ))}

        {/* pospuestas: siguen existiendo, así que se ven, pero apagadas y
            sin contar como abiertas. */}
        {pospuestas.length > 0 ? (
          <Box mx={-16} mt="$sm">
            <SectionHead>Pospuestas</SectionHead>
          </Box>
        ) : null}
        {pospuestas.map((v) => (
          <Card key={v.id} fd="row" ai="center" gap="$md">
            <Box h={32} w={32} ai="center" jc="center" br={10} bg="$bg3">
              <Icon name="calendar" color={c.muted} size={18} />
            </Box>
            <Col f={1}>
              <Txt font="bold" fos={14}>
                {v.brand} {v.model}
              </Txt>
              <Txt fos={12} tone="muted" mt={1}>
                {v.gauge?.status === 'danger' ? 'Vencido' : 'Próximo'} · {vuelveEn(v.alertSnoozedUntil!, ahora)}
              </Txt>
            </Col>
            <Btn kind="ghost" size="sm" onPress={() => void reactivar(v)}>
              Reactivar
            </Btn>
          </Card>
        ))}

        {/* resueltas: sin cambios que hayan atendido una alerta no hay nada
            que listar, y un encabezado solo sobre el vacío parece un error. */}
        {resueltas.length > 0 ? (
          <Box mx={-16} mt="$sm">
            <SectionHead>Resueltas</SectionHead>
          </Box>
        ) : null}
        {resueltas.map((ch) => {
          const v = vehicleOf(ch.vehicleId);
          return (
            <Card key={ch.id} fd="row" ai="center" gap="$md">
              <Box h={32} w={32} ai="center" jc="center" br={10} bg="$okSoft">
                <Icon name="check" color={c.ok} size={18} />
              </Box>
              <Col f={1}>
                <Txt font="bold" fos={14}>{v ? `${v.brand} ${v.model}` : 'Vehículo'}</Txt>
                <Txt fos={12} tone="muted" mt={1}>
                  {ch.resolvedAlert === 'danger' ? 'Estaba vencido' : 'Estaba próximo'} · cambio el{' '}
                  {fmtFecha(ch.changedAt)} · {fmtKm(ch.km)} km
                </Txt>
              </Col>
              <Txt font="monoMed" fos={11} tone="muted2">{fmtHace(ch.changedAt)}</Txt>
            </Card>
          );
        })}
      </Scroll>
    </Box>
  );
}
