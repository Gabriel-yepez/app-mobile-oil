// Perfil — hero oscuro con avatar + datos personales + preferencias.
// Cerrar sesión y Notificaciones viven en el Menú desde que el perfil dejó de
// ser un destino raíz del tab bar.
import React, { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import { Box, Col, Row, Touchable, Txt, useAppColors } from '../ui';
import { Avatar, Card, IconBtn, SectionHead } from '../components/primitives';
import { PlanHeader, UsoLista } from '../components/subscription';
import { HeroSurface, useHeroTopColor } from '../components/HeroSurface';
import { StickyHeader, estimarHeaderH } from '../components/StickyHeader';
import { Icon, IconName } from '../components/Icon';
import { useStore, usePlan, usePlanUsage } from '../store/useStore';
import { useVehicles } from '../store/useVehicles';
import { useAllOilChanges } from '../hooks/useAllOilChanges';
import { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });
  const [headerH, setHeaderH] = useState(estimarHeaderH(insets.top));
  const navigation = useNavigation<Nav>();
  const c = useAppColors();
  const heroTop = useHeroTopColor();
  const profile = useStore((s) => s.profile);
  const vehicles = useVehicles((s) => s.vehicles);
  const { items: changes } = useAllOilChanges();
  const subscription = useStore((s) => s.subscription);
  const plan = usePlan();
  const uso = usePlanUsage();

  const personalRows = [
    { k: 'Cédula', v: profile.cedula, mono: true },
    { k: 'Correo', v: profile.email },
    { k: 'Teléfono', v: profile.phone, mono: true },
    { k: 'Estado', v: profile.state },
    { k: 'Ciudad', v: profile.city },
  ];

  // Notificaciones y Cerrar sesión se mudaron al Menú: el perfil dejó de ser un
  // destino raíz, así que es el menú el lugar donde se los busca.
  const prefRows: { k: string; v: string; icon: IconName }[] = [
    { k: 'Unidad', v: 'Kilómetros', icon: 'gauge' },
    { k: 'Idioma', v: 'Español (VE)', icon: 'flag' },
    { k: 'Privacidad', v: '', icon: 'shield' },
  ];

  return (
    <Box f={1} bg="$bg3">
      {/* El header va ENCIMA del scroll —no arriba de él— para que el cristal
          tenga algo que desenfocar cuando el contenido pasa por debajo. */}
      <StickyHeader
        scrollY={scrollY}
        onBack={() => navigation.goBack()}
        actionIcon="edit"
        onAction={() => navigation.navigate('EditProfile')}
        onHeight={setHeaderH}
      />

      <Animated.ScrollView
        style={{ flex: 1, backgroundColor: c.bg3 }}
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {/* Fondo absoluto para cubrir el overscroll superior */}
        <Box pos="absolute" t={-1000} l={0} r={0} h={1000} bg={heroTop} />
        {/* El header no pinta nada propio: deja ver este degradado, así que no
            hay dos azules que puedan desalinearse. */}
        <HeroSurface
          style={{
            paddingTop: headerH,
            borderBottomLeftRadius: 28,
            borderBottomRightRadius: 28,
            overflow: 'hidden',
          }}
        >

          <Row gap={14} px="$xl" pb="$2xl" pt="$sm">
            <Avatar name={profile.fullName} size={72} ring={3} />
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
        </HeroSurface>

        {/* suscripción — resumen tocable; el detalle vive en su propia pantalla */}
        <Box pt={18}>
          <SectionHead>Suscripción</SectionHead>
          <Box px="$lg">
            <Touchable fade sink transition="quick" onPress={() => navigation.navigate('Subscription')}>
              <Card>
                <PlanHeader plan={plan} subscription={subscription} />
                <Box mt="$lg">
                  <UsoLista items={uso} />
                </Box>
                <Row ai="center" jc="center" gap={4} mt="$lg">
                  <Txt font="semi" fos={13} tone="accent">Ver detalle del plan</Txt>
                  <Icon name="chevR" color={c.accent} size={16} />
                </Row>
              </Card>
            </Touchable>
          </Box>
        </Box>

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
                <Row
                  key={r.k}
                  ai="center"
                  gap="$md"
                  px="$lg"
                  py={14}
                  borderBottomWidth={i !== prefRows.length - 1 ? 1 : 0}
                  borderBottomColor="$line2"
                >
                  <Box h={32} w={32} ai="center" jc="center" br={10} bg="$accentSoft">
                    <Icon name={r.icon} color={c.accent} size={18} />
                  </Box>
                  <Txt f={1} font="semi" fos={14}>{r.k}</Txt>
                  {r.v ? <Txt fos={13} tone="muted">{r.v}</Txt> : null}
                </Row>
              ))}
            </Card>
          </Box>
        </Box>

        <Box px="$lg" pt={18}>
          <Txt font="monoMed" fos={11} tone="muted2" ls={0.4} ta="center" mt="$md">
            Ruédalo · v1.0.0
          </Txt>
        </Box>
      </Animated.ScrollView>
    </Box>
  );
}
