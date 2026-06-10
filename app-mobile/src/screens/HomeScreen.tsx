// Home — header oscuro con gauge radial, tech readout, KPIs e historial reciente
import React, { useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { fonts, palette, radius, T } from '../theme';
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
    <View style={{ flex: 1, backgroundColor: T.bg3 }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
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
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <View>
              <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: 'rgba(255,255,255,0.65)', letterSpacing: 1, textTransform: 'uppercase' }}>
                Hola, {firstName}
              </Text>
              <Text style={{ fontFamily: fonts.display, fontSize: 22, color: '#fff', marginTop: 2, letterSpacing: -0.4 }}>
                Tu tablero del día
              </Text>
            </View>
            <Pressable
              onPress={() => navigation.navigate('Tabs' as never)}
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                backgroundColor: 'rgba(255,255,255,0.1)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="bell" color="#fff" size={20} />
              {openAlerts > 0 ? (
                <View
                  style={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: T.warn,
                  }}
                />
              ) : null}
            </Pressable>
          </View>

          {/* pill del vehículo activo */}
          <Pressable
            onPress={() => setPickerOpen(true)}
            style={{
              paddingVertical: 10,
              paddingHorizontal: 12,
              borderRadius: 14,
              backgroundColor: 'rgba(255,255,255,0.06)',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.1)',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              marginBottom: 16,
            }}
          >
            <VehicleThumb kind={active.kind} color={active.color} size={36} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.sansBold, fontSize: 14, color: '#fff' }}>
                {active.brand} {active.model}
              </Text>
              <Text style={{ fontFamily: fonts.monoMed, fontSize: 11, color: 'rgba(255,255,255,0.65)' }}>
                {active.plate} · {active.year}
              </Text>
            </View>
            <Icon name="chevD" color="rgba(255,255,255,0.7)" size={20} />
          </Pressable>

          {/* gauge */}
          <Pressable
            style={{ alignItems: 'center', marginTop: 4, marginBottom: 8 }}
            onPress={() => navigation.navigate('AddOil', { vehicleId: active.id })}
          >
            <OilGauge pct={pct} kmLeft={kmLeft(active)} size={220} />
          </Pressable>

          {/* tech readout */}
          <View
            style={{
              flexDirection: 'row',
              paddingVertical: 12,
              paddingHorizontal: 14,
              borderRadius: 14,
              backgroundColor: 'rgba(0,0,0,0.18)',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.08)',
              marginTop: 4,
            }}
          >
            {[
              { l: 'Odómetro', v: fmtKm(active.km), u: 'km' },
              { l: 'Próximo', v: fmtKm(active.nextChange), u: 'km' },
              { l: 'Aceite', v: active.oil.viscosity, u: active.oil.brand },
            ].map((r) => (
              <View key={r.l} style={{ flex: 1, alignItems: 'center' }}>
                <Text style={{ fontFamily: fonts.sansBold, fontSize: 9, letterSpacing: 1.2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)' }}>
                  {r.l}
                </Text>
                <Text style={{ fontFamily: fonts.mono, fontSize: 16, color: '#fff', marginTop: 2 }}>{r.v}</Text>
                <Text style={{ fontFamily: fonts.sans, fontSize: 10, color: 'rgba(255,255,255,0.55)' }}>{r.u}</Text>
              </View>
            ))}
          </View>
        </LinearGradient>

        {/* KPI row */}
        <View style={{ paddingHorizontal: 16, paddingTop: 16, flexDirection: 'row', gap: 10 }}>
          <KPI icon={<Icon name="car" color={palette.accent} size={18} />} label="Vehículos" value={vehicles.length} unit="activos" />
          <KPI icon={<Icon name="calendar" color={palette.accent} size={18} />} label="Últ. cambio" value={active.daysSince} unit="días" />
          <KPI icon={<Icon name="bell" color={T.warn} size={18} />} label="Alertas" value={openAlerts} unit="abiertas" />
        </View>

        {/* Historial reciente */}
        <View style={{ paddingTop: 20 }}>
          <SectionHead
            right={
              <Pressable onPress={() => navigation.navigate('History')} hitSlop={8}>
                <Text style={{ fontFamily: fonts.sansSemi, fontSize: 12, color: palette.accent }}>Ver todo</Text>
              </Pressable>
            }
          >
            Historial reciente
          </SectionHead>
          <View style={{ paddingHorizontal: 16, gap: 10 }}>
            {recent.map((h) => (
              <Card key={h.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    backgroundColor: `${palette.accent}14`,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon name="drop" color={palette.accent} size={18} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: fonts.sansBold, fontSize: 14, color: T.ink }}>{vehicleName(h.vehicleId)}</Text>
                  <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: T.muted, marginTop: 1 }}>
                    {h.date} · <Text style={{ fontFamily: fonts.monoMed }}>{fmtKm(h.km)}</Text> km · {h.oil.brand} {h.oil.viscosity}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontFamily: fonts.mono, fontSize: 14, color: T.ink }}>{fmtUsd(h.costUsd)}</Text>
                  <Text style={{ fontFamily: fonts.sans, fontSize: 10, color: T.muted2 }}>USD</Text>
                </View>
              </Card>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* selector de vehículo activo */}
      <Modal visible={pickerOpen} transparent animationType="fade" onRequestClose={() => setPickerOpen(false)}>
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(10,18,38,0.4)', justifyContent: 'flex-end' }}
          onPress={() => setPickerOpen(false)}
        >
          <View
            style={{
              backgroundColor: '#fff',
              borderTopLeftRadius: radius.xl,
              borderTopRightRadius: radius.xl,
              paddingVertical: 12,
              paddingBottom: insets.bottom + 12,
            }}
          >
            <FlatList
              data={vehicles}
              keyExtractor={(v) => v.id}
              renderItem={({ item }) => (
                <Pressable
                  style={({ pressed }) => [
                    { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 24, paddingVertical: 12 },
                    pressed && { backgroundColor: T.bg2 },
                  ]}
                  onPress={() => {
                    setActiveVehicle(item.id);
                    setPickerOpen(false);
                  }}
                >
                  <VehicleThumb kind={item.kind} color={item.color} size={40} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: fonts.sansBold, fontSize: 14, color: T.ink }}>
                      {item.brand} {item.model}
                    </Text>
                    <Text style={{ fontFamily: fonts.monoMed, fontSize: 11, color: T.muted }}>
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
