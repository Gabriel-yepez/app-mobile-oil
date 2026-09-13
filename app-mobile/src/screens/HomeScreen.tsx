// Home — header oscuro con gauge radial, tech readout, KPIs e historial reciente
import React, { useState } from 'react';
import { FlatList, Modal } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Box, Col, Row, Scroll, Touchable, Txt, useAppColors } from '../ui';
import { Card, KPI, SectionHead, TechGrid, VehicleThumb } from '../components/primitives';
import { OilGauge } from '../components/OilGauge';
import { Icon } from '../components/Icon';
import { fmtKm, fmtUsd } from '../utils/format';
import { kmLeft, oilPct, useActiveVehicle, useOpenAlerts, useStore } from '../store/useStore';
import { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function HomeScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const c = useAppColors();
  const vehicles = useStore((s) => s.vehicles);
  const changes = useStore((s) => s.changes);
  const profile = useStore((s) => s.profile);
  const setActiveVehicle = useStore((s) => s.setActiveVehicle);
  const active = useActiveVehicle();
  const openAlerts = useOpenAlerts();
  const [pickerOpen, setPickerOpen] = useState(false);

  const pct = oilPct(active);
  const firstName = profile.fullName.split(' ')[0];
  const recent = changes.slice(0, 3);
  const vehicleName = (id: string) => {
    const v = vehicles.find((x) => x.id === id);
    return v ? `${v.brand} ${v.model.split(' ')[0]}` : '';
  };

  return (
    <Box f={1} bg="$bg3">
      <Scroll bg="$bg3" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Panel oscuro tipo tablero */}
        <LinearGradient
          colors={[c.primary, c.primary2]}
          style={{
            paddingTop: insets.top + 12,
            paddingHorizontal: 20,
            paddingBottom: 28,
            borderBottomLeftRadius: 32,
            borderBottomRightRadius: 32,
            overflow: 'hidden',
          }}
        >
          <TechGrid />

          {/* greeting */}
          <Row mb="$lg" jc="space-between">
            <Col>
              <Txt fos={12} col="rgba(255,255,255,0.65)" ls={1} caps>
                Hola, {firstName}
              </Txt>
              <Txt font="display" fos={22} tone="onDark" ls={-0.4} mt={2}>
                Tu tablero del día
              </Txt>
            </Col>
            <Touchable
              onPress={() => navigation.navigate('Tabs' as never)}
              fade
              transition="quick"
              h={40}
              w={40}
              ai="center"
              jc="center"
              br={12}
              bg="rgba(255,255,255,0.1)"
            >
              <Icon name="bell" color="#fff" size={20} />
              {openAlerts > 0 ? (
                <Box pos="absolute" r={8} t={8} h={8} w={8} br="$pill" bg="$warn" />
              ) : null}
            </Touchable>
          </Row>

          {/* pill del vehículo activo */}
          <Touchable
            onPress={() => setPickerOpen(true)}
            fade
            transition="quick"
            mb="$lg"
            fd="row"
            ai="center"
            gap={10}
            br={14}
            bw={1}
            bc="rgba(255,255,255,0.1)"
            bg="rgba(255,255,255,0.06)"
            px="$md"
            py={10}
          >
            <VehicleThumb kind={active.kind} color={active.color} size={36} />
            <Col f={1}>
              <Txt font="bold" fos={14} tone="onDark">
                {active.brand} {active.model}
              </Txt>
              <Txt font="monoMed" fos={11} col="rgba(255,255,255,0.65)">
                {active.plate} · {active.year}
              </Txt>
            </Col>
            <Icon name="chevD" color="rgba(255,255,255,0.7)" size={20} />
          </Touchable>

          {/* gauge */}
          <Touchable
            fade
            mb="$sm"
            mt={4}
            ai="center"
            onPress={() => navigation.navigate('AddOil', { vehicleId: active.id })}
          >
            <OilGauge pct={pct} kmLeft={kmLeft(active)} size={220} />
          </Touchable>

          {/* tech readout */}
          <Row mt={4} br={14} bw={1} bc="rgba(255,255,255,0.08)" bg="rgba(0,0,0,0.18)" px={14} py="$md" ai="stretch">
            {[
              { l: 'Odómetro', v: fmtKm(active.km), u: 'km' },
              { l: 'Próximo', v: fmtKm(active.nextChange), u: 'km' },
              { l: 'Aceite', v: active.oil.viscosity, u: active.oil.brand },
            ].map((r) => (
              <Col key={r.l} f={1} ai="center">
                <Txt font="bold" fos={9} col="rgba(255,255,255,0.55)" ls={1.2} caps>
                  {r.l}
                </Txt>
                <Txt font="mono" fos={16} tone="onDark" mt={2}>{r.v}</Txt>
                <Txt fos={10} col="rgba(255,255,255,0.55)">{r.u}</Txt>
              </Col>
            ))}
          </Row>
        </LinearGradient>

        {/* KPI row */}
        <Row gap={10} px="$lg" pt="$lg" ai="stretch">
          <KPI icon={<Icon name="car" color={c.accent} size={18} />} label="Vehículos" value={vehicles.length} unit="activos" />
          <KPI icon={<Icon name="calendar" color={c.accent} size={18} />} label="Últ. cambio" value={active.daysSince} unit="días" />
          <KPI icon={<Icon name="bell" color={c.warn} size={18} />} label="Alertas" value={openAlerts} unit="abiertas" />
        </Row>

        {/* Historial reciente */}
        <Box pt="$xl">
          <SectionHead
            right={
              <Touchable onPress={() => navigation.navigate('History')} hitSlop={8} fade>
                <Txt font="semi" fos={12} tone="accent">Ver todo</Txt>
              </Touchable>
            }
          >
            Historial reciente
          </SectionHead>
          <Col gap={10} px="$lg">
            {recent.map((h) => (
              <Card key={h.id} fd="row" ai="center" gap="$md">
                <Box h={36} w={36} ai="center" jc="center" br={10} bg="$accentSoft">
                  <Icon name="drop" color={c.accent} size={18} />
                </Box>
                <Col f={1}>
                  <Txt font="bold" fos={14}>{vehicleName(h.vehicleId)}</Txt>
                  <Txt fos={12} tone="muted" mt={1}>
                    {h.date} · <Txt font="monoMed" fos={12} tone="muted">{fmtKm(h.km)}</Txt> km · {h.oil.brand} {h.oil.viscosity}
                  </Txt>
                </Col>
                <Col ai="flex-end">
                  <Txt font="mono" fos={14}>{fmtUsd(h.costUsd)}</Txt>
                  <Txt fos={10} tone="muted2">USD</Txt>
                </Col>
              </Card>
            ))}
          </Col>
        </Box>
      </Scroll>

      {/* selector de vehículo activo */}
      <Modal visible={pickerOpen} transparent animationType="fade" onRequestClose={() => setPickerOpen(false)}>
        <Touchable f={1} jc="flex-end" bg="$scrim" onPress={() => setPickerOpen(false)}>
          <Box
            borderTopLeftRadius="$xl"
            borderTopRightRadius="$xl"
            bg="$surface"
            pt="$md"
            pb={insets.bottom + 12}
            transition="bouncy"
            enterStyle={{ y: 40, opacity: 0 }}
          >
            <FlatList
              data={vehicles}
              keyExtractor={(v) => v.id}
              renderItem={({ item }) => (
                <Touchable
                  fd="row"
                  ai="center"
                  gap="$md"
                  px="$2xl"
                  py="$md"
                  pressStyle={{ bg: '$bg2' }}
                  onPress={() => {
                    setActiveVehicle(item.id);
                    setPickerOpen(false);
                  }}
                >
                  <VehicleThumb kind={item.kind} color={item.color} size={40} />
                  <Col f={1}>
                    <Txt font="bold" fos={14}>
                      {item.brand} {item.model}
                    </Txt>
                    <Txt font="monoMed" fos={11} tone="muted">
                      {item.plate} · {item.year}
                    </Txt>
                  </Col>
                  {item.id === active.id ? <Icon name="check" color={c.accent} size={18} /> : null}
                </Touchable>
              )}
            />
          </Box>
        </Touchable>
      </Modal>
    </Box>
  );
}
