// Detalle del vehículo — hero oscuro + card de aceite + timeline de historial
import React, { useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import { Box, Col, Row, Txt, useAppColors } from '../ui';
import { Btn, Card, IconBtn, SectionHead, StatusPill, VehicleThumb, VinPlate } from '../components/primitives';
import { HeroSurface, useHeroTopColor } from '../components/HeroSurface';
import { StickyHeader, estimarHeaderH } from '../components/StickyHeader';
import { Icon } from '../components/Icon';
import { fmtKm, fmtUsd } from '../utils/format';
import { kmLeft, oilPct, useStore, vehicleStatus } from '../store/useStore';
import { RootScreenProps } from '../navigation/types';

export function VehicleDetailScreen({ navigation, route }: RootScreenProps<'VehicleDetail'>) {
  const insets = useSafeAreaInsets();
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });
  const [headerH, setHeaderH] = useState(estimarHeaderH(insets.top));
  const c = useAppColors();
  const heroTop = useHeroTopColor();
  const vehicle = useStore((s) => s.vehicles.find((v) => v.id === route.params.vehicleId));
  const changes = useStore((s) => s.changes).filter((ch) => ch.vehicleId === route.params.vehicleId);
  const profile = useStore((s) => s.profile);

  if (!vehicle) return null;
  const pct = oilPct(vehicle);
  const status = vehicleStatus(vehicle);

  return (
    <Box f={1} bg="$bg3">
      {/* El header va ENCIMA del scroll —no arriba de él— para que el cristal
          tenga algo que desenfocar cuando el contenido pasa por debajo. */}
      <StickyHeader
        scrollY={scrollY}
        onBack={() => navigation.goBack()}
        actionIcon="edit"
        onAction={() => navigation.navigate('EditVehicle', { vehicleId: vehicle.id })}
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
            paddingHorizontal: 20,
            paddingBottom: 24,
            borderBottomLeftRadius: 28,
            borderBottomRightRadius: 28,
            overflow: 'hidden',
          }}
        >

          <Row gap={14}>
            <VehicleThumb kind={vehicle.kind} color={vehicle.color} size={68} />
            <Col f={1}>
              <Row mb={4} gap="$sm">
                <VinPlate>{vehicle.plate}</VinPlate>
                <VinPlate>{vehicle.year}</VinPlate>
              </Row>
              <Txt font="display" fos={26} tone="onDark" ls={-0.5}>
                {vehicle.brand} {vehicle.model}
              </Txt>
              <Txt fos={13} tone="onDarkSoft">
                {vehicle.kind === 'car' ? 'Carro' : 'Moto'} · {profile.city}, {profile.state}
              </Txt>
            </Col>
          </Row>

          {/* mini stats */}
          <Row mt={18} gap="$sm" ai="stretch">
            {[
              { l: 'Odómetro', v: fmtKm(vehicle.km), u: 'km' },
              { l: 'Vida aceite', v: `${pct}%`, u: '' },
              { l: 'Restan', v: fmtKm(kmLeft(vehicle)), u: 'km' },
            ].map((s) => (
              <Col
                key={s.l}
                f={1}
                br={12}
                bw={1}
                bc="rgba(255,255,255,0.1)"
                bg="rgba(255,255,255,0.08)"
                px="$md"
                py={10}
              >
                <Txt font="bold" fos={9} tone="onDarkMuted" ls={1.2} caps>
                  {s.l}
                </Txt>
                <Txt font="mono" fos={17} tone="onDark" mt={2}>{s.v}</Txt>
                {s.u ? <Txt fos={10} col="rgba(255,255,255,0.55)">{s.u}</Txt> : null}
              </Col>
            ))}
          </Row>
        </HeroSurface>

        {/* oil card */}
        <Box px="$lg" pt={18}>
          <Card>
            <Row mb="$md" gap="$md">
              <Box h={44} w={44} ai="center" jc="center" br={12} bg="$accentSoft">
                <Icon name="oil" color={c.accent} size={22} />
              </Box>
              <Col f={1}>
                <Txt font="bold" fos={11} tone="muted" ls={1} caps>
                  Aceite actual
                </Txt>
                <Txt font="display" fos={17}>
                  {vehicle.oil.brand} {vehicle.oil.tag}
                </Txt>
              </Col>
              <StatusPill status={status} />
            </Row>
            <Row gap={10} ai="stretch">
              {[
                { l: 'Viscosidad', v: vehicle.oil.viscosity },
                { l: 'Último km', v: fmtKm(vehicle.lastChange) },
                { l: 'Próximo km', v: fmtKm(vehicle.nextChange) },
              ].map((col) => (
                <Col key={col.l} f={1} borderTopWidth={1} borderTopColor="$line" py={10}>
                  <Txt font="bold" fos={10} tone="muted2" ls={1} caps>
                    {col.l}
                  </Txt>
                  <Txt font="mono" fos={15} mt={2}>{col.v}</Txt>
                </Col>
              ))}
            </Row>
            <Btn
              kind="primary"
              size="md"
              style={{ marginTop: 12 }}
              icon={<Icon name="drop" color="#fff" size={18} />}
              onPress={() => navigation.navigate('AddOil', { vehicleId: vehicle.id })}
            >
              Registrar nuevo cambio
            </Btn>
          </Card>
        </Box>

        {/* timeline historial */}
        <Box pt="$xl">
          <SectionHead>Historial de aceite</SectionHead>
          <Box px="$lg">
            {changes.map((h, i) => (
              <Row key={h.id} ai="stretch" gap={14} px={4}>
                {/* línea de tiempo */}
                <Col w={24} ai="center">
                  <Box
                    mt={18}
                    h={12}
                    w={12}
                    br="$pill"
                    bw={2}
                    bc={i === 0 ? '$accent' : '$line'}
                    bg={i === 0 ? '$accent' : '$bg2'}
                  />
                  {i < changes.length - 1 ? <Box mt={4} w={2} f={1} bg="$line" /> : null}
                </Col>
                <Card mb={10} f={1}>
                  <Row mb={4} jc="space-between">
                    <Txt font="monoMed" fos={12} tone="muted">{h.date}</Txt>
                    <Txt font="mono" fos={13}>{fmtKm(h.km)} km</Txt>
                  </Row>
                  <Txt font="bold" fos={14}>
                    {h.oil.brand} {h.oil.tag} {h.oil.viscosity}
                  </Txt>
                  <Txt fos={12} tone="muted" mt={2}>
                    {h.shop} · {fmtUsd(h.costUsd)} USD
                  </Txt>
                </Card>
              </Row>
            ))}
          </Box>
        </Box>
      </Animated.ScrollView>
    </Box>
  );
}
