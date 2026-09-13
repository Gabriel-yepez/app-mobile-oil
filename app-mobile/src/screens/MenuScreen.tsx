// Menú — tercer destino del tab bar. No tiene contenido propio: es el índice
// de todo lo que dejó de ser un tab cuando la barra bajó a tres destinos.
import React from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Box, Col, Row, Scroll, Touchable, Txt, useAppColors } from '../ui';
import { Card, SectionHead } from '../components/primitives';
import { Icon, IconName } from '../components/Icon';
import { useOpenAlerts, useStore } from '../store/useStore';
import { useNotifPrefs } from '../store/notifPrefs';
import { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type Fila = { k: string; v?: string; icon: IconName; onPress: () => void };

export function MenuScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const c = useAppColors();
  const profile = useStore((s) => s.profile);
  const openAlerts = useOpenAlerts();
  const notifEnabled = useNotifPrefs((s) => s.prefs.enabled);

  const cuenta: Fila[] = [
    { k: 'Mi perfil', v: profile.fullName, icon: 'user', onPress: () => navigation.navigate('Profile') },
    {
      k: 'Alertas',
      v: openAlerts > 0 ? `${openAlerts} abiertas` : 'Al día',
      icon: 'bell',
      onPress: () => navigation.navigate('Alerts'),
    },
    { k: 'Historial', icon: 'history', onPress: () => navigation.navigate('History') },
  ];

  const gestion: Fila[] = [
    { k: 'Agregar vehículo', icon: 'plus', onPress: () => navigation.navigate('AddVehicleType') },
    { k: 'Personalizar inicio', icon: 'sliders', onPress: () => navigation.navigate('CustomizeHome') },
    {
      k: 'Notificaciones',
      v: notifEnabled ? 'Activadas' : 'Desactivadas',
      icon: 'settings',
      onPress: () => navigation.navigate('Notifications'),
    },
  ];

  const grupo = (filas: Fila[]) => (
    <Box px="$lg">
      <Card padded={false}>
        {filas.map((r, i) => (
          <Touchable
            key={r.k}
            onPress={r.onPress}
            fd="row"
            ai="center"
            gap="$md"
            px="$lg"
            py={14}
            pressStyle={{ bg: '$bg2' }}
            borderBottomWidth={i !== filas.length - 1 ? 1 : 0}
            borderBottomColor="$line2"
          >
            <Box h={32} w={32} ai="center" jc="center" br={10} bg="$accentSoft">
              <Icon name={r.icon} color={c.accent} size={18} />
            </Box>
            <Txt f={1} font="semi" fos={14}>{r.k}</Txt>
            {r.v ? <Txt fos={13} tone="muted">{r.v}</Txt> : null}
            <Icon name="chevR" color={c.muted2} size={20} />
          </Touchable>
        ))}
      </Card>
    </Box>
  );

  return (
    <Box f={1} bg="$bg3">
      <Row jc="space-between" px="$xl" pb={14} pt={insets.top + 12}>
        <Col>
          <Txt fos={12} tone="muted" ls={1} caps>
            OilTrack VE
          </Txt>
          <Txt font="display" fos={26} ls={-0.5}>
            Menú
          </Txt>
        </Col>
      </Row>

      <Scroll bg="$bg3" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        <SectionHead>Cuenta</SectionHead>
        {grupo(cuenta)}

        <Box pt={18}>
          <SectionHead>Gestión</SectionHead>
          {grupo(gestion)}
        </Box>

        {/* Cerrar sesión se mudó acá desde Perfil: ahora que el perfil dejó de
            ser un destino raíz, el menú es el lugar donde se lo busca. */}
        <Box px="$lg" pt={18}>
          <Touchable
            onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Login' }] })}
            transition="quick"
            h={48}
            fd="row"
            ai="center"
            jc="center"
            gap="$sm"
            br="$md"
            bw={1.5}
            bc="$line"
            bg="transparent"
            pressStyle={{ bg: '$bg2' }}
          >
            <Icon name="logout" color={c.danger} size={20} />
            <Txt font="semi" fos={15} tone="danger">Cerrar sesión</Txt>
          </Touchable>
          <Txt font="monoMed" fos={11} tone="muted2" ls={0.4} ta="center" mt="$md">
            OilTrack VE · v1.0.0
          </Txt>
        </Box>
      </Scroll>
    </Box>
  );
}
