// Ajustes de notificaciones — switch maestro, tipos de aviso, día y hora del
// recordatorio, y salida a los ajustes del sistema si el permiso está bloqueado.
import React, { useCallback, useState } from 'react';
import { Switch } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Box, Col, Row, Screen, Scroll, Txt, useAppColors } from '../ui';
import { Btn, Card, IconBtn, SectionHead, Select } from '../components/primitives';
import { Icon } from '../components/Icon';
import { fmtKm } from '../utils/format';
import { useNotifPrefs } from '../store/notifPrefs';
import {
  getPermissionState,
  openSystemSettings,
  requestPermission,
  type PermissionState,
} from '../notifications';

const WEEKDAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const HOURS = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, '0')}:00`);

export function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const c = useAppColors();
  const prefs = useNotifPrefs((s) => s.prefs);
  const setPref = useNotifPrefs((s) => s.setPref);
  const markPermissionAsked = useNotifPrefs((s) => s.markPermissionAsked);
  const [permission, setPermission] = useState<PermissionState>('undetermined');

  // Al volver a la pantalla: el usuario puede haber cambiado el permiso en los
  // ajustes del teléfono mientras tanto.
  useFocusEffect(
    useCallback(() => {
      void getPermissionState().then(setPermission);
    }, [])
  );

  const blocked = permission === 'denied';
  const master = prefs.enabled && !blocked;

  const onActivate = async () => {
    const state = await requestPermission();
    markPermissionAsked();
    setPermission(state);
    setPref('enabled', state === 'granted');
  };

  const toggle = (
    label: string,
    hint: string,
    value: boolean,
    onChange: (v: boolean) => void,
    disabled = false
  ) => (
    <Row key={label} jc="space-between" ai="center" gap="$md" px="$lg" py={14}>
      <Col f={1} gap={2}>
        <Txt font="semi" fos={14} tone={disabled ? 'muted2' : 'ink'}>
          {label}
        </Txt>
        <Txt fos={12} tone="muted">
          {hint}
        </Txt>
      </Col>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ false: c.line, true: c.accent }}
      />
    </Row>
  );

  return (
    <Screen>
      <Row jc="space-between" ai="center" px="$lg" pb="$md" style={{ paddingTop: insets.top + 12 }}>
        <IconBtn
          icon={<Icon name="chevL" color={c.ink} size={20} />}
          onPress={() => navigation.goBack()}
        />
        <Txt font="display" fos={18}>
          Notificaciones
        </Txt>
        <Box w={36} />
      </Row>

      <Scroll
        contentContainerStyle={{ paddingBottom: 48, gap: 18 }}
        showsVerticalScrollIndicator={false}
      >
        {blocked ? (
          <Box px="$lg">
            <Card>
              <Col gap="$sm" p="$lg">
                <Row gap="$sm" ai="center">
                  <Icon name="bell" color={c.danger} size={18} />
                  <Txt font="semi" fos={14} tone="danger">
                    Permiso bloqueado en el sistema
                  </Txt>
                </Row>
                <Txt fos={13} tone="muted">
                  Tu teléfono tiene bloqueadas las notificaciones de OilTrack VE. Actívalas desde
                  los ajustes para volver a recibir avisos.
                </Txt>
                <Btn size="sm" onPress={openSystemSettings}>
                  Abrir ajustes
                </Btn>
              </Col>
            </Card>
          </Box>
        ) : permission === 'undetermined' ? (
          <Box px="$lg">
            <Card>
              <Col gap="$sm" p="$lg">
                <Txt fos={13} tone="muted">
                  Activa los avisos para enterarte del cambio de aceite sin abrir la app.
                </Txt>
                <Btn size="sm" onPress={() => void onActivate()}>
                  Activar
                </Btn>
              </Col>
            </Card>
          </Box>
        ) : null}

        <Col gap="$sm">
          <SectionHead>Avisos</SectionHead>
          <Box px="$lg">
            <Card padded={false}>
              {toggle(
                'Notificaciones',
                'Interruptor general de todos los avisos',
                master,
                (v) => setPref('enabled', v),
                blocked
              )}
              {toggle(
                'Cambio próximo',
                `Cuando falten menos de ${fmtKm(prefs.warnThresholdKm)} km`,
                prefs.warnEnabled,
                (v) => setPref('warnEnabled', v),
                !master
              )}
              {toggle(
                'Cambio vencido',
                'Cuando el vehículo pasó el kilometraje recomendado',
                prefs.overdueEnabled,
                (v) => setPref('overdueEnabled', v),
                !master
              )}
              {toggle(
                'Recordatorio semanal',
                'Para que actualices el kilometraje',
                prefs.checkinEnabled,
                (v) => setPref('checkinEnabled', v),
                !master
              )}
            </Card>
          </Box>
        </Col>

        <Col gap="$sm">
          <SectionHead>Recordatorio semanal</SectionHead>
          <Box px="$lg">
            <Card>
              <Col gap="$md" p="$lg">
                <Col gap={6}>
                  <Txt fos={12} tone="muted" ls={1} caps>
                    Día
                  </Txt>
                  <Select
                    value={WEEKDAYS[prefs.checkinWeekday - 1]}
                    options={WEEKDAYS}
                    onChange={(v) => setPref('checkinWeekday', WEEKDAYS.indexOf(v) + 1)}
                  />
                </Col>
                <Col gap={6}>
                  <Txt fos={12} tone="muted" ls={1} caps>
                    Hora
                  </Txt>
                  <Select
                    value={`${String(prefs.checkinHour).padStart(2, '0')}:00`}
                    options={HOURS}
                    onChange={(v) => setPref('checkinHour', Number(v.slice(0, 2)))}
                  />
                </Col>
                <Txt fos={12} tone="muted">
                  Los avisos de cambio próximo y vencido se entregan a las 09:00.
                </Txt>
              </Col>
            </Card>
          </Box>
        </Col>
      </Scroll>
    </Screen>
  );
}
