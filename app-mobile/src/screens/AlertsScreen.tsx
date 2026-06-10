// Alertas — agrupadas por estado: crítica (vencido), warning (próximo) y resueltas
import React from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ScrollView, Text, View } from '../tw';
import { T } from '../theme';
import { Btn, Card, IconBtn, SectionHead } from '../components/primitives';
import { Icon } from '../components/Icon';
import { fmtKm } from '../utils/format';
import { kmLeft, useStore, vehicleStatus } from '../store/useStore';
import { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// Resueltas (mock estático — vendrá del backend)
const RESOLVED = [
  { v: 'Bera BR-200', text: 'Cambio realizado el 14 ene · 17.000 km', date: 'hace 26d' },
  { v: 'Toyota Corolla', text: 'Cambio realizado el 21 oct · 67.800 km', date: 'hace 110d' },
];

export function AlertsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const vehicles = useStore((s) => s.vehicles);

  const overdue = vehicles.filter((v) => vehicleStatus(v) === 'danger');
  const soon = vehicles.filter((v) => vehicleStatus(v) === 'warn');
  const open = overdue.length + soon.length;

  return (
    <View className="flex-1 bg-bg3">
      {/* top bar */}
      <View
        className="flex-row items-center justify-between px-5 pb-3.5"
        style={{ paddingTop: insets.top + 12 }}
      >
        <View>
          <Text className="font-sans text-[12px] text-muted tracking-[1px] uppercase">
            Alertas
          </Text>
          <Text className="font-display text-[26px] text-ink tracking-[-0.5px]">
            {open} abiertas
          </Text>
        </View>
        <IconBtn icon={<Icon name="settings" color={T.ink} size={20} />} size={40} />
      </View>

      <ScrollView contentContainerClassName="gap-3 px-4 pb-[120px]" showsVerticalScrollIndicator={false}>
        {/* críticas: vencido */}
        {overdue.map((v) => (
          <View
            key={v.id}
            className="overflow-hidden rounded-lg border-[1.5px] border-[rgba(239,68,68,0.2)] shadow-card"
          >
            <LinearGradient colors={['#FEF2F2', '#ffffff']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 16 }}>
              <View className="mb-2.5 flex-row items-center gap-2.5">
                <View className="h-9 w-9 items-center justify-center rounded-[10px] bg-danger">
                  <Icon name="bell" color="#fff" size={20} />
                </View>
                <View className="flex-1">
                  <Text className="font-sans-bold text-[11px] text-danger tracking-[1.2px] uppercase">
                    Cambio vencido
                  </Text>
                  <Text className="font-display text-[17px] text-ink">
                    {v.brand} {v.model}
                  </Text>
                </View>
              </View>
              <Text className="font-sans text-[13px] leading-[19.5px] text-muted">
                Has superado el kilometraje recomendado. Excedido por{' '}
                <Text className="font-mono text-danger">+{fmtKm(Math.abs(kmLeft(v)))} km</Text>.
              </Text>
              <View className="mt-3 flex-row gap-2">
                <Btn
                  kind="primary"
                  size="sm"
                  className="flex-1 bg-danger"
                  onPress={() => navigation.navigate('AddOil', { vehicleId: v.id })}
                >
                  Registrar cambio
                </Btn>
                <Btn kind="ghost" size="sm" className="flex-1">
                  Posponer
                </Btn>
              </View>
            </LinearGradient>
          </View>
        ))}

        {/* warning: próximo */}
        {soon.map((v) => (
          <View
            key={v.id}
            className="overflow-hidden rounded-lg border-[1.5px] border-[rgba(245,158,11,0.2)] shadow-card"
          >
            <LinearGradient colors={['#FFFBEB', '#ffffff']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 16 }}>
              <View className="mb-2.5 flex-row items-center gap-2.5">
                <View className="h-9 w-9 items-center justify-center rounded-[10px] bg-warn">
                  <Icon name="gauge" color="#fff" size={20} />
                </View>
                <View className="flex-1">
                  <Text className="font-sans-bold text-[11px] text-[#B45309] tracking-[1.2px] uppercase">
                    Próximo cambio
                  </Text>
                  <Text className="font-display text-[17px] text-ink">
                    {v.brand} {v.model}
                  </Text>
                </View>
              </View>
              <Text className="font-sans text-[13px] leading-[19.5px] text-muted">
                Restan <Text className="font-mono text-[#B45309]">{fmtKm(kmLeft(v))} km</Text> para el próximo
                cambio. Programa tu visita al lubricentro.
              </Text>
            </LinearGradient>
          </View>
        ))}

        {/* resueltas */}
        <View className="-mx-4 mt-2">
          <SectionHead>Resueltas</SectionHead>
        </View>
        {RESOLVED.map((r, i) => (
          <Card key={i} className="flex-row items-center gap-3">
            <View className="h-8 w-8 items-center justify-center rounded-[10px] bg-[#ECFDF5]">
              <Icon name="check" color={T.ok} size={18} />
            </View>
            <View className="flex-1">
              <Text className="font-sans-bold text-[14px] text-ink">{r.v}</Text>
              <Text className="mt-px font-sans text-[12px] text-muted">{r.text}</Text>
            </View>
            <Text className="font-mono-med text-[11px] text-muted2">{r.date}</Text>
          </Card>
        ))}
      </ScrollView>
    </View>
  );
}
