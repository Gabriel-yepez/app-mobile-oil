// Garaje — lista multi-vehículo con filter chips y progreso de aceite
import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { fonts, palette, radius, T } from '../theme';
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
    <View style={{ flex: 1, backgroundColor: T.bg3 }}>
      {/* top bar */}
      <View
        style={{
          paddingTop: insets.top + 12,
          paddingHorizontal: 20,
          paddingBottom: 14,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <View>
          <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: T.muted, letterSpacing: 1, textTransform: 'uppercase' }}>
            Mis vehículos
          </Text>
          <Text style={{ fontFamily: fonts.display, fontSize: 26, color: T.ink, letterSpacing: -0.5 }}>
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
      <View style={{ paddingHorizontal: 20, flexDirection: 'row', gap: 8, marginBottom: 16 }}>
        {chips.map((c) => {
          const isActive = filter === c.id;
          return (
            <Pressable
              key={c.id}
              onPress={() => setFilter(c.id)}
              style={{
                height: 34,
                paddingHorizontal: 14,
                borderRadius: radius.pill,
                backgroundColor: isActive ? palette.primary : '#fff',
                borderWidth: isActive ? 0 : 1,
                borderColor: T.line,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Text style={{ fontFamily: fonts.sansSemi, fontSize: 13, color: isActive ? '#fff' : T.ink }}>{c.label}</Text>
              <View
                style={{
                  paddingHorizontal: 6,
                  paddingVertical: 1,
                  borderRadius: 6,
                  backgroundColor: isActive ? 'rgba(255,255,255,0.18)' : T.bg2,
                }}
              >
                <Text style={{ fontFamily: fonts.monoMed, fontSize: 10, color: isActive ? '#fff' : T.muted }}>{c.n}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120, gap: 12 }} showsVerticalScrollIndicator={false}>
        {filtered.map((v) => {
          const pct = oilPct(v);
          const status = vehicleStatus(v);
          const accent = status === 'ok' ? T.ok : status === 'warn' ? T.warn : T.danger;
          return (
            <Pressable key={v.id} onPress={() => navigation.navigate('VehicleDetail', { vehicleId: v.id })}>
              <Card>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                  <VehicleThumb kind={v.kind} color={v.color} size={56} />
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1, borderColor: T.line }}>
                        <Text style={{ fontFamily: fonts.monoMed, fontSize: 10, letterSpacing: 0.5, color: T.muted }}>
                          {v.kind === 'car' ? 'CARRO' : 'MOTO'}
                        </Text>
                      </View>
                      <StatusPill status={status} />
                    </View>
                    <Text style={{ fontFamily: fonts.sansBold, fontSize: 16, color: T.ink, letterSpacing: -0.2 }}>
                      {v.brand} {v.model}
                    </Text>
                    <Text style={{ fontFamily: fonts.monoMed, fontSize: 12, color: T.muted, marginTop: 1 }}>
                      {v.plate} · {v.year} · {fmtKm(v.km)} km
                    </Text>
                  </View>
                  <Icon name="chevR" color={T.muted2} size={22} />
                </View>

                {/* mini progress */}
                <View style={{ marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{ flex: 1, height: 6, backgroundColor: T.bg2, borderRadius: 3, overflow: 'hidden' }}>
                    <View
                      style={{
                        width: `${Math.max(4, Math.min(100, pct))}%`,
                        height: '100%',
                        backgroundColor: accent,
                        borderRadius: 3,
                      }}
                    />
                  </View>
                  <Text style={{ fontFamily: fonts.mono, fontSize: 12, color: T.ink, minWidth: 88, textAlign: 'right' }}>
                    {fmtKm(kmLeft(v))} <Text style={{ color: T.muted, fontFamily: fonts.sans }}>km</Text>
                  </Text>
                </View>
              </Card>
            </Pressable>
          );
        })}

        {/* agregar vehículo */}
        <Pressable
          onPress={() => navigation.navigate('AddVehicleType')}
          style={{
            height: 80,
            borderRadius: radius.lg,
            borderWidth: 1.5,
            borderStyle: 'dashed',
            borderColor: T.line,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
          }}
        >
          <Icon name="plus" color={palette.accent} size={18} />
          <Text style={{ fontFamily: fonts.sansSemi, fontSize: 14, color: palette.accent }}>Agregar vehículo</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
