// Historial completo — resumen de inversión USD/Bs.S + lista de todos los cambios
import React from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import clsx from 'clsx';
import { ScrollView, Text, View } from '../tw';
import { palette, radius, T } from '../theme';
import { Card, IconBtn, VehicleThumb } from '../components/primitives';
import { Icon } from '../components/Icon';
import { fmtKm, fmtUsd } from '../utils/format';
import { BS_RATE, SPEND_BARS } from '../data/mock';
import { useStore } from '../store/useStore';

export function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const changes = useStore((s) => s.changes);
  const vehicles = useStore((s) => s.vehicles);

  const totalUsd = changes.reduce((sum, c) => sum + c.costUsd, 0);
  const maxBar = Math.max(...SPEND_BARS);
  const vehicleOf = (id: string) => vehicles.find((v) => v.id === id);

  return (
    <View className="flex-1 bg-bg3">
      {/* top bar */}
      <View
        className="flex-row items-center justify-between px-5 pb-3.5"
        style={{ paddingTop: insets.top + 12 }}
      >
        <View className="flex-row items-center gap-3">
          {navigation.canGoBack() ? (
            <IconBtn icon={<Icon name="chevL" color={T.ink} size={20} />} onPress={() => navigation.goBack()} />
          ) : null}
          <View>
            <Text className="font-sans text-[12px] text-muted tracking-[1px] uppercase">
              Historial
            </Text>
            <Text className="font-display text-[26px] text-ink tracking-[-0.5px]">
              {changes.length} cambios
            </Text>
          </View>
        </View>
        <IconBtn icon={<Icon name="search" color={T.ink} size={20} />} size={40} />
      </View>

      <ScrollView contentContainerClassName="pb-[120px]" showsVerticalScrollIndicator={false}>
        {/* inversión */}
        <View className="px-4 pb-3.5">
          <LinearGradient
            colors={[palette.primary, palette.primary2]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ borderRadius: radius.lg, padding: 16 }}
          >
            <Text className="font-sans-bold text-[11px] text-[rgba(255,255,255,0.6)] tracking-[1.2px] uppercase">
              Inversión 2026
            </Text>
            <View className="mt-1.5 flex-row items-baseline gap-2">
              <Text className="font-mono text-[32px] text-white tracking-[-1px]">{fmtUsd(totalUsd)}</Text>
              <Text className="font-sans text-[12px] text-[rgba(255,255,255,0.7)]">
                USD · ≈ Bs.S {fmtKm(totalUsd * BS_RATE)}
              </Text>
            </View>

            {/* mini bar chart */}
            <View className="mt-3.5 h-[50px] flex-row items-end gap-1.5">
              {SPEND_BARS.map((h, i) => (
                <View
                  key={i}
                  className={clsx(
                    'flex-1 rounded-[3px]',
                    i === SPEND_BARS.length - 1 ? 'bg-accent2' : 'bg-[rgba(255,255,255,0.18)]'
                  )}
                  style={{ height: `${(h / maxBar) * 100}%` }}
                />
              ))}
            </View>
            <View className="mt-1.5 flex-row justify-between">
              {['ENE', 'ABR', 'JUL', 'OCT', 'DIC'].map((m) => (
                <Text key={m} className="font-mono-med text-[10px] text-[rgba(255,255,255,0.6)]">
                  {m}
                </Text>
              ))}
            </View>
          </LinearGradient>
        </View>

        {/* lista */}
        <View className="gap-2.5 px-4">
          {changes.map((h) => {
            const v = vehicleOf(h.vehicleId);
            return (
              <Card key={h.id} className="flex-row items-center gap-3">
                <VehicleThumb kind={v?.kind ?? 'car'} color={v?.color ?? '#1F2937'} size={42} />
                <View className="flex-1">
                  <Text className="font-sans-bold text-[14px] text-ink tracking-[-0.1px]">
                    {v ? `${v.brand} ${v.model}` : 'Vehículo'}
                  </Text>
                  <Text className="mt-px font-sans text-[12px] text-muted">
                    <Text className="font-mono-med">{h.date}</Text> ·{' '}
                    <Text className="font-mono-med">{fmtKm(h.km)}</Text> km
                  </Text>
                  <Text className="mt-px font-sans text-[12px] text-muted2">
                    {h.oil.brand} {h.oil.tag} {h.oil.viscosity}
                  </Text>
                </View>
                <View className="items-end">
                  <Text className="font-mono text-[14px] text-ink">{fmtUsd(h.costUsd)}</Text>
                  <Text className="font-sans text-[10px] text-muted2">USD</Text>
                </View>
              </Card>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}
