// Perfil — hero oscuro con avatar + datos personales + preferencias + cerrar sesión
import React from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Box, Col, Row, Scroll, Touchable, Txt, useAppColors } from '../ui';
import { palette } from '../theme';
import { Card, IconBtn, SectionHead, TechGrid } from '../components/primitives';
import { Icon, IconName } from '../components/Icon';
import { useStore } from '../store/useStore';
import { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const c = useAppColors();
  const profile = useStore((s) => s.profile);
  const vehicles = useStore((s) => s.vehicles);
  const changes = useStore((s) => s.changes);

  const initials = profile.fullName
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('');

  const personalRows = [
    { k: 'Correo', v: profile.email },
    { k: 'Teléfono', v: profile.phone, mono: true },
    { k: 'Estado', v: profile.state },
    { k: 'Ciudad', v: profile.city },
    { k: 'Moneda', v: 'USD · Bs.S' },
  ];

  const prefRows: { k: string; v: string; icon: IconName }[] = [
    { k: 'Notificaciones', v: 'Activadas', icon: 'bell' },
    { k: 'Unidad', v: 'Kilómetros', icon: 'gauge' },
    { k: 'Idioma', v: 'Español (VE)', icon: 'flag' },
    { k: 'Privacidad', v: '', icon: 'shield' },
  ];

  return (
    <Box f={1} bg="$bg3">
      <Scroll bg="$bg3" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        {/* hero */}
        <LinearGradient
          colors={[c.primary, c.primary2]}
          style={{
            paddingTop: insets.top + 12,
            borderBottomLeftRadius: 28,
            borderBottomRightRadius: 28,
            overflow: 'hidden',
          }}
        >
          <TechGrid />
          <Row jc="space-between" px="$xl" pb="$sm">
            <Txt fos={12} tone="onDarkSoft" ls={1} caps>
              Perfil
            </Txt>
            <IconBtn onDark icon={<Icon name="edit" color="#fff" size={20} />} />
          </Row>

          <Row gap={14} px="$xl" pb="$2xl" pt="$sm">
            <LinearGradient
              colors={[palette.accent2, palette.primary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                width: 72,
                height: 72,
                borderRadius: 36,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 3,
                borderColor: 'rgba(255,255,255,0.2)',
              }}
            >
              <Txt font="display" fos={26} tone="onDark">{initials}</Txt>
            </LinearGradient>
            <Col f={1}>
              <Txt font="display" fos={22} tone="onDark" ls={-0.4}>
                {profile.fullName}
              </Txt>
              <Txt font="monoMed" fos={12} tone="onDarkSoft" mt={2}>
                {profile.cedula}
              </Txt>
              <Row mt={6} gap={6} als="flex-start" br="$pill" bg="rgba(255,255,255,0.1)" px="$sm" py={3}>
                <Box h={6} w={6} br="$pill" bg="$ok" />
                <Txt font="semi" fos={11} tone="onDark">Cuenta verificada</Txt>
              </Row>
            </Col>
          </Row>

          {/* mini stats */}
          <Row gap="$sm" px="$xl" pb="$2xl" ai="stretch">
            {[
              { l: 'Vehículos', v: String(vehicles.length) },
              { l: 'Cambios', v: String(changes.length) },
              { l: 'Activo', v: '8m' },
            ].map((s) => (
              <Col
                key={s.l}
                f={1}
                ai="center"
                br={12}
                bw={1}
                bc="rgba(255,255,255,0.08)"
                bg="rgba(255,255,255,0.08)"
                px="$md"
                py={10}
              >
                <Txt font="mono" fos={18} tone="onDark">{s.v}</Txt>
                <Txt fos={10} col="rgba(255,255,255,0.65)" ls={1} caps>
                  {s.l}
                </Txt>
              </Col>
            ))}
          </Row>
        </LinearGradient>

        {/* datos personales */}
        <Box pt={18}>
          <SectionHead>Datos personales</SectionHead>
          <Box px="$lg">
            <Card>
              {personalRows.map((r, i) => (
                <Row
                  key={r.k}
                  jc="space-between"
                  py="$md"
                  borderBottomWidth={i !== personalRows.length - 1 ? 1 : 0}
                  borderBottomColor="$line2"
                >
                  <Txt fos={13} tone="muted">{r.k}</Txt>
                  <Txt fos={14} font={r.mono ? 'monoMed' : 'semi'}>
                    {r.v}
                  </Txt>
                </Row>
              ))}
            </Card>
          </Box>
        </Box>

        {/* preferencias */}
        <Box pt={18}>
          <SectionHead>Preferencias</SectionHead>
          <Box px="$lg">
            <Card padded={false}>
              {prefRows.map((r, i) => (
                <Touchable
                  key={r.k}
                  fd="row"
                  ai="center"
                  gap="$md"
                  px="$lg"
                  py={14}
                  pressStyle={{ bg: '$bg2' }}
                  borderBottomWidth={i !== prefRows.length - 1 ? 1 : 0}
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
        </Box>

        {/* cerrar sesión */}
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
