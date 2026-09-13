// Garaje — lista multi-vehículo con filter chips y progreso de aceite
import React, { useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Box, Col, Row, Scroll, Touchable, Txt, useAppColors } from '../ui';
import { Card, FilterChip, FilterChips, IconBtn, StatusPill, VehicleThumb } from '../components/primitives';
import { Icon } from '../components/Icon';
import { fmtKm } from '../utils/format';
import { kmLeft, oilPct, useStore, vehicleStatus } from '../store/useStore';
import { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Filter = 'all' | 'car' | 'moto';

export function VehiclesScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const c = useAppColors();
  const vehicles = useStore((s) => s.vehicles);
  const [filter, setFilter] = useState<Filter>('all');

  const cars = vehicles.filter((v) => v.kind === 'car').length;
  const motos = vehicles.filter((v) => v.kind === 'moto').length;
  const filtered = filter === 'all' ? vehicles : vehicles.filter((v) => v.kind === filter);

  const chips: FilterChip<Filter>[] = [
    { id: 'all', label: 'Todos', n: vehicles.length },
    { id: 'car', label: 'Carros', n: cars },
    { id: 'moto', label: 'Motos', n: motos },
  ];

  return (
    <Box f={1} bg="$bg3">
      {/* top bar */}
      <Row jc="space-between" px="$xl" pb={14} pt={insets.top + 12}>
        <Col>
          <Txt font="display" fos={32} ls={-0.5}>
            Garaje · {vehicles.length}
          </Txt>
        </Col>
        <IconBtn
          icon={<Icon name="plus" color="#fff" size={22} />}
          filled
          size={40}
          onPress={() => navigation.navigate('AddVehicleType')}
        />
      </Row>

      <Box mb="$lg" px="$xl">
        <FilterChips chips={chips} value={filter} onChange={setFilter} />
      </Box>

      <Scroll
        bg="$bg3"
        contentContainerStyle={{ gap: 12, paddingHorizontal: 16, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {filtered.map((v) => {
          const pct = oilPct(v);
          const status = vehicleStatus(v);
          const accent = status === 'ok' ? c.ok : status === 'warn' ? c.warn : c.danger;
          return (
            <Touchable key={v.id} fade sink transition="quick" onPress={() => navigation.navigate('VehicleDetail', { vehicleId: v.id })}>
              <Card>
                <Row gap={14}>
                  <VehicleThumb kind={v.kind} color={v.color} size={56} />
                  <Col f={1}>
                    <Row mb={4} gap="$sm">
                      <Box br={4} bw={1} bc="$line" px={6} py={2}>
                        <Txt font="monoMed" fos={10} tone="muted" ls={0.5}>
                          {v.kind === 'car' ? 'CARRO' : 'MOTO'}
                        </Txt>
                      </Box>
                      <StatusPill status={status} />
                    </Row>
                    <Txt font="bold" fos={16} ls={-0.2}>
                      {v.brand} {v.model}
                    </Txt>
                    <Txt font="monoMed" fos={12} tone="muted" mt={1}>
                      {v.plate} · {v.year} · {fmtKm(v.km)} km
                    </Txt>
                  </Col>
                  <Icon name="chevR" color={c.muted2} size={22} />
                </Row>

                {/* mini progress */}
                <Row mt={14} gap={10}>
                  <Box h={6} f={1} ov="hidden" br={3} bg="$bg2">
                    <Box
                      h="100%"
                      br={3}
                      bg={accent}
                      width={`${Math.max(4, Math.min(100, pct))}%`}
                      transition="gauge"
                      enterStyle={{ width: '0%' }}
                    />
                  </Box>
                  <Txt font="mono" fos={12} minWidth={88} ta="right">
                    {fmtKm(kmLeft(v))} <Txt fos={12} tone="muted">km</Txt>
                  </Txt>
                </Row>
              </Card>
            </Touchable>
          );
        })}

        {/* agregar vehículo */}
        <Touchable
          onPress={() => navigation.navigate('AddVehicleType')}
          fade
          sink
          transition="quick"
          h={56}
          fd="row"
          ai="center"
          jc="center"
          gap={10}
          br="$lg"
          bw={1}
          bc="$accent"
          borderStyle="dashed"
          bg="$surfaceDim"
        >
          <Icon name="plus" color={c.accent} size={18} />
          <Txt font="semi" fos={14} tone="accent">Agregar vehículo</Txt>
        </Touchable>
      </Scroll>
    </Box>
  );
}
