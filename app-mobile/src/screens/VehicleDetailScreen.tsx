// Detalle del vehículo — hero oscuro + card de aceite + timeline de historial
import React from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import clsx from 'clsx';
import { ScrollView, Text, View } from '../tw';
import { palette } from '../theme';
import { Btn, Card, IconBtn, SectionHead, StatusPill, TechGrid, VehicleThumb, VinPlate } from '../components/primitives';
import { Icon } from '../components/Icon';
import { fmtKm, fmtUsd } from '../utils/format';
import { kmLeft, oilPct, useStore, vehicleStatus } from '../store/useStore';
import { RootScreenProps } from '../navigation/types';

export function VehicleDetailScreen({ navigation, route }: RootScreenProps<'VehicleDetail'>) {
  const insets = useSafeAreaInsets();
  const vehicle = useStore((s) => s.vehicles.find((v) => v.id === route.params.vehicleId));
  const changes = useStore((s) => s.changes.filter((c) => c.vehicleId === route.params.vehicleId));
  const profile = useStore((s) => s.profile);

  if (!vehicle) return null;
  const pct = oilPct(vehicle);
  const status = vehicleStatus(vehicle);

  return (
    <View className="flex-1 bg-bg3">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-[120px]">
        {/* hero */}
        <LinearGradient
          colors={[palette.primary, palette.primary2]}
          style={{
            paddingTop: insets.top + 12,
            paddingHorizontal: 20,
            paddingBottom: 24,
            borderBottomLeftRadius: 28,
            borderBottomRightRadius: 28,
            overflow: 'hidden',
          }}
        >
          <TechGrid />
          <View className="mb-5 flex-row items-center justify-between">
            <IconBtn dark icon={<Icon name="chevL" color="#fff" size={20} />} onPress={() => navigation.goBack()} />
            <IconBtn dark icon={<Icon name="edit" color="#fff" size={20} />} />
          </View>

          <View className="flex-row items-center gap-3.5">
            <VehicleThumb kind={vehicle.kind} color={vehicle.color} size={68} />
            <View className="flex-1">
              <View className="mb-1 flex-row items-center gap-2">
                <VinPlate>{vehicle.plate}</VinPlate>
                <VinPlate>{vehicle.year}</VinPlate>
              </View>
              <Text className="font-display text-[26px] text-white tracking-[-0.5px]">
                {vehicle.brand} {vehicle.model}
              </Text>
              <Text className="font-sans text-[13px] text-[rgba(255,255,255,0.7)]">
                {vehicle.kind === 'car' ? 'Carro' : 'Moto'} · {profile.city}, {profile.state}
              </Text>
            </View>
          </View>

          {/* mini stats */}
          <View className="mt-[18px] flex-row gap-2">
            {[
              { l: 'Odómetro', v: fmtKm(vehicle.km), u: 'km' },
              { l: 'Vida aceite', v: `${pct}%`, u: '' },
              { l: 'Restan', v: fmtKm(kmLeft(vehicle)), u: 'km' },
            ].map((s) => (
              <View
                key={s.l}
                className="flex-1 rounded-[12px] border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.08)] px-3 py-2.5"
              >
                <Text className="font-sans-bold text-[9px] text-[rgba(255,255,255,0.6)] tracking-[1.2px] uppercase">
                  {s.l}
                </Text>
                <Text className="mt-0.5 font-mono text-[17px] text-white">{s.v}</Text>
                {s.u ? <Text className="font-sans text-[10px] text-[rgba(255,255,255,0.55)]">{s.u}</Text> : null}
              </View>
            ))}
          </View>
        </LinearGradient>

        {/* oil card */}
        <View className="px-4 pt-[18px]">
          <Card>
            <View className="mb-3 flex-row items-center gap-3">
              <View className="h-11 w-11 items-center justify-center rounded-[12px] bg-[rgba(37,99,235,0.08)]">
                <Icon name="oil" color={palette.accent} size={22} />
              </View>
              <View className="flex-1">
                <Text className="font-sans-bold text-[11px] text-muted tracking-[1px] uppercase">
                  Aceite actual
                </Text>
                <Text className="font-display text-[17px] text-ink">
                  {vehicle.oil.brand} {vehicle.oil.tag}
                </Text>
              </View>
              <StatusPill status={status} />
            </View>
            <View className="flex-row gap-2.5">
              {[
                { l: 'Viscosidad', v: vehicle.oil.viscosity },
                { l: 'Último km', v: fmtKm(vehicle.lastChange) },
                { l: 'Próximo km', v: fmtKm(vehicle.nextChange) },
              ].map((c) => (
                <View key={c.l} className="flex-1 border-t border-line py-2.5">
                  <Text className="font-sans-bold text-[10px] text-muted2 tracking-[1px] uppercase">
                    {c.l}
                  </Text>
                  <Text className="mt-0.5 font-mono text-[15px] text-ink">{c.v}</Text>
                </View>
              ))}
            </View>
            <Btn
              kind="primary"
              size="md"
              className="mt-3"
              icon={<Icon name="drop" color="#fff" size={18} />}
              onPress={() => navigation.navigate('AddOil', { vehicleId: vehicle.id })}
            >
              Registrar nuevo cambio
            </Btn>
          </Card>
        </View>

        {/* timeline historial */}
        <View className="pt-5">
          <SectionHead>Historial de aceite</SectionHead>
          <View className="px-4">
            {changes.map((h, i) => (
              <View key={h.id} className="flex-row gap-3.5 px-1">
                {/* línea de tiempo */}
                <View className="w-6 items-center">
                  <View
                    className={clsx(
                      'mt-[18px] h-3 w-3 rounded-full border-2',
                      i === 0 ? 'border-accent bg-accent' : 'border-line bg-bg2'
                    )}
                  />
                  {i < changes.length - 1 ? <View className="mt-1 w-0.5 flex-1 bg-line" /> : null}
                </View>
                <Card className="mb-2.5 flex-1">
                  <View className="mb-1 flex-row items-center justify-between">
                    <Text className="font-mono-med text-[12px] text-muted">{h.date}</Text>
                    <Text className="font-mono text-[13px] text-ink">{fmtKm(h.km)} km</Text>
                  </View>
                  <Text className="font-sans-bold text-[14px] text-ink">
                    {h.oil.brand} {h.oil.tag} {h.oil.viscosity}
                  </Text>
                  <Text className="mt-0.5 font-sans text-[12px] text-muted">
                    {h.shop} · {fmtUsd(h.costUsd)} USD
                  </Text>
                </Card>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
