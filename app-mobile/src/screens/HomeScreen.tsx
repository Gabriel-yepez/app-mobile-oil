// Home — header oscuro con gauge radial, tech readout, KPIs e historial reciente
import React, { useState } from 'react';
import { FlatList, Modal } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Pressable, ScrollView, Text, View } from '../tw';
import { palette, T } from '../theme';
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
    <View className="flex-1 bg-bg3">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-[120px]">
        {/* Panel oscuro tipo tablero */}
        <LinearGradient
          colors={[palette.primary, palette.primary2]}
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
          <View className="mb-4 flex-row items-center justify-between">
            <View>
              <Text className="font-sans text-[12px] text-[rgba(255,255,255,0.65)] tracking-[1px] uppercase">
                Hola, {firstName}
              </Text>
              <Text className="mt-0.5 font-display text-[22px] text-white tracking-[-0.4px]">
                Tu tablero del día
              </Text>
            </View>
            <Pressable
              onPress={() => navigation.navigate('Tabs' as never)}
              className="h-10 w-10 items-center justify-center rounded-[12px] bg-[rgba(255,255,255,0.1)]"
            >
              <Icon name="bell" color="#fff" size={20} />
              {openAlerts > 0 ? (
                <View className="absolute right-2 top-2 h-2 w-2 rounded-full bg-warn" />
              ) : null}
            </Pressable>
          </View>

          {/* pill del vehículo activo */}
          <Pressable
            onPress={() => setPickerOpen(true)}
            className="mb-4 flex-row items-center gap-2.5 rounded-[14px] border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.06)] px-3 py-2.5"
          >
            <VehicleThumb kind={active.kind} color={active.color} size={36} />
            <View className="flex-1">
              <Text className="font-sans-bold text-[14px] text-white">
                {active.brand} {active.model}
              </Text>
              <Text className="font-mono-med text-[11px] text-[rgba(255,255,255,0.65)]">
                {active.plate} · {active.year}
              </Text>
            </View>
            <Icon name="chevD" color="rgba(255,255,255,0.7)" size={20} />
          </Pressable>

          {/* gauge */}
          <Pressable
            className="mb-2 mt-1 items-center"
            onPress={() => navigation.navigate('AddOil', { vehicleId: active.id })}
          >
            <OilGauge pct={pct} kmLeft={kmLeft(active)} size={220} />
          </Pressable>

          {/* tech readout */}
          <View className="mt-1 flex-row rounded-[14px] border border-[rgba(255,255,255,0.08)] bg-[rgba(0,0,0,0.18)] px-3.5 py-3">
            {[
              { l: 'Odómetro', v: fmtKm(active.km), u: 'km' },
              { l: 'Próximo', v: fmtKm(active.nextChange), u: 'km' },
              { l: 'Aceite', v: active.oil.viscosity, u: active.oil.brand },
            ].map((r) => (
              <View key={r.l} className="flex-1 items-center">
                <Text className="font-sans-bold text-[9px] text-[rgba(255,255,255,0.55)] tracking-[1.2px] uppercase">
                  {r.l}
                </Text>
                <Text className="mt-0.5 font-mono text-[16px] text-white">{r.v}</Text>
                <Text className="font-sans text-[10px] text-[rgba(255,255,255,0.55)]">{r.u}</Text>
              </View>
            ))}
          </View>
        </LinearGradient>

        {/* KPI row */}
        <View className="flex-row gap-2.5 px-4 pt-4">
          <KPI icon={<Icon name="car" color={palette.accent} size={18} />} label="Vehículos" value={vehicles.length} unit="activos" />
          <KPI icon={<Icon name="calendar" color={palette.accent} size={18} />} label="Últ. cambio" value={active.daysSince} unit="días" />
          <KPI icon={<Icon name="bell" color={T.warn} size={18} />} label="Alertas" value={openAlerts} unit="abiertas" />
        </View>

        {/* Historial reciente */}
        <View className="pt-5">
          <SectionHead
            right={
              <Pressable onPress={() => navigation.navigate('History')} hitSlop={8}>
                <Text className="font-sans-semi text-[12px] text-accent">Ver todo</Text>
              </Pressable>
            }
          >
            Historial reciente
          </SectionHead>
          <View className="gap-2.5 px-4">
            {recent.map((h) => (
              <Card key={h.id} className="flex-row items-center gap-3">
                <View className="h-9 w-9 items-center justify-center rounded-[10px] bg-[rgba(37,99,235,0.08)]">
                  <Icon name="drop" color={palette.accent} size={18} />
                </View>
                <View className="flex-1">
                  <Text className="font-sans-bold text-[14px] text-ink">{vehicleName(h.vehicleId)}</Text>
                  <Text className="mt-px font-sans text-[12px] text-muted">
                    {h.date} · <Text className="font-mono-med">{fmtKm(h.km)}</Text> km · {h.oil.brand} {h.oil.viscosity}
                  </Text>
                </View>
                <View className="items-end">
                  <Text className="font-mono text-[14px] text-ink">{fmtUsd(h.costUsd)}</Text>
                  <Text className="font-sans text-[10px] text-muted2">USD</Text>
                </View>
              </Card>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* selector de vehículo activo */}
      <Modal visible={pickerOpen} transparent animationType="fade" onRequestClose={() => setPickerOpen(false)}>
        <Pressable
          className="flex-1 justify-end bg-[rgba(10,18,38,0.4)]"
          onPress={() => setPickerOpen(false)}
        >
          <View
            className="rounded-t-xl bg-white pt-3"
            style={{ paddingBottom: insets.bottom + 12 }}
          >
            <FlatList
              data={vehicles}
              keyExtractor={(v) => v.id}
              renderItem={({ item }) => (
                <Pressable
                  className="flex-row items-center gap-3 px-6 py-3 active:bg-bg2"
                  onPress={() => {
                    setActiveVehicle(item.id);
                    setPickerOpen(false);
                  }}
                >
                  <VehicleThumb kind={item.kind} color={item.color} size={40} />
                  <View className="flex-1">
                    <Text className="font-sans-bold text-[14px] text-ink">
                      {item.brand} {item.model}
                    </Text>
                    <Text className="font-mono-med text-[11px] text-muted">
                      {item.plate} · {item.year}
                    </Text>
                  </View>
                  {item.id === active.id ? <Icon name="check" color={palette.accent} size={18} /> : null}
                </Pressable>
              )}
            />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}
