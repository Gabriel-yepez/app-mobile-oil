// Garaje — lista multi-vehículo con filter chips y progreso de aceite
import React, { useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import clsx from 'clsx';
import { Pressable, ScrollView, Text, View } from '../tw';
import { palette, T } from '../theme';
import { Card, IconBtn, StatusPill, VehicleThumb } from '../components/primitives';
import { Icon } from '../components/Icon';
import { fmtKm } from '../utils/format';
import { kmLeft, oilPct, useStore, vehicleStatus } from '../store/useStore';
import { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Filter = 'all' | 'car' | 'moto';

export function VehiclesScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const vehicles = useStore((s) => s.vehicles);
  const [filter, setFilter] = useState<Filter>('all');

  const cars = vehicles.filter((v) => v.kind === 'car').length;
  const motos = vehicles.filter((v) => v.kind === 'moto').length;
  const filtered = filter === 'all' ? vehicles : vehicles.filter((v) => v.kind === filter);

  const chips: { id: Filter; label: string; n: number }[] = [
    { id: 'all', label: 'Todos', n: vehicles.length },
    { id: 'car', label: 'Carros', n: cars },
    { id: 'moto', label: 'Motos', n: motos },
  ];

  return (
    <View className="flex-1 bg-bg3">
      {/* top bar */}
      <View
        className="flex-row items-center justify-between px-5 pb-3.5"
        style={{ paddingTop: insets.top + 12 }}
      >
        <View>
          <Text className="font-sans text-[12px] text-muted tracking-[1px] uppercase">
            Mis vehículos
          </Text>
          <Text className="font-display text-[26px] text-ink tracking-[-0.5px]">
            Garaje · {vehicles.length}
          </Text>
        </View>
        <IconBtn
          icon={<Icon name="plus" color="#fff" size={22} />}
          filled
          size={40}
          onPress={() => navigation.navigate('AddVehicleType')}
        />
      </View>

      {/* filter chips */}
      <View className="mb-4 flex-row gap-2 px-5">
        {chips.map((c) => {
          const isActive = filter === c.id;
          return (
            <Pressable
              key={c.id}
              onPress={() => setFilter(c.id)}
              className={clsx(
                'h-[34px] flex-row items-center gap-1.5 rounded-full px-3.5',
                isActive ? 'bg-primary' : 'border border-line bg-white'
              )}
            >
              <Text className={clsx('font-sans-semi text-[13px]', isActive ? 'text-white' : 'text-ink')}>
                {c.label}
              </Text>
              <View
                className={clsx(
                  'rounded-[6px] px-1.5 py-px',
                  isActive ? 'bg-[rgba(255,255,255,0.18)]' : 'bg-bg2'
                )}
              >
                <Text className={clsx('font-mono-med text-[10px]', isActive ? 'text-white' : 'text-muted')}>
                  {c.n}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <ScrollView contentContainerClassName="gap-3 px-4 pb-[120px]" showsVerticalScrollIndicator={false}>
        {filtered.map((v) => {
          const pct = oilPct(v);
          const status = vehicleStatus(v);
          const accent = status === 'ok' ? T.ok : status === 'warn' ? T.warn : T.danger;
          return (
            <Pressable key={v.id} onPress={() => navigation.navigate('VehicleDetail', { vehicleId: v.id })}>
              <Card>
                <View className="flex-row items-center gap-3.5">
                  <VehicleThumb kind={v.kind} color={v.color} size={56} />
                  <View className="flex-1">
                    <View className="mb-1 flex-row items-center gap-2">
                      <View className="rounded-[4px] border border-line px-1.5 py-0.5">
                        <Text className="font-mono-med text-[10px] text-muted tracking-[0.5px]">
                          {v.kind === 'car' ? 'CARRO' : 'MOTO'}
                        </Text>
                      </View>
                      <StatusPill status={status} />
                    </View>
                    <Text className="font-sans-bold text-[16px] text-ink tracking-[-0.2px]">
                      {v.brand} {v.model}
                    </Text>
                    <Text className="mt-px font-mono-med text-[12px] text-muted">
                      {v.plate} · {v.year} · {fmtKm(v.km)} km
                    </Text>
                  </View>
                  <Icon name="chevR" color={T.muted2} size={22} />
                </View>

                {/* mini progress */}
                <View className="mt-3.5 flex-row items-center gap-2.5">
                  <View className="h-1.5 flex-1 overflow-hidden rounded-[3px] bg-bg2">
                    <View
                      className="h-full rounded-[3px]"
                      style={{
                        width: `${Math.max(4, Math.min(100, pct))}%`,
                        backgroundColor: accent,
                      }}
                    />
                  </View>
                  <Text className="min-w-[88px] text-right font-mono text-[12px] text-ink">
                    {fmtKm(kmLeft(v))} <Text className="font-sans text-muted">km</Text>
                  </Text>
                </View>
              </Card>
            </Pressable>
          );
        })}

        {/* agregar vehículo */}
        <Pressable
          onPress={() => navigation.navigate('AddVehicleType')}
          className="h-20 flex-row items-center justify-center gap-2.5 rounded-lg border-[1.5px] border-dashed border-line"
        >
          <Icon name="plus" color={palette.accent} size={18} />
          <Text className="font-sans-semi text-[14px] text-accent">Agregar vehículo</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
