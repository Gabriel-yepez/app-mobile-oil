// Historial completo — resumen de inversión USD/Bs.S + lista de todos los cambios
import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { fonts, palette, radius, T } from '../theme';
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
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {navigation.canGoBack() ? (
            <IconBtn icon={<Icon name="chevL" color={T.ink} size={20} />} onPress={() => navigation.goBack()} />
          ) : null}
          <View>
            <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: T.muted, letterSpacing: 1, textTransform: 'uppercase' }}>
              Historial
            </Text>
            <Text style={{ fontFamily: fonts.display, fontSize: 26, color: T.ink, letterSpacing: -0.5 }}>
              {changes.length} cambios
            </Text>
          </View>
        </View>
        <IconBtn icon={<Icon name="search" color={T.ink} size={20} />} size={40} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        {/* inversión */}
        <View style={{ paddingHorizontal: 16, paddingBottom: 14 }}>
          <LinearGradient
            colors={[palette.primary, palette.primary2]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ borderRadius: radius.lg, padding: 16 }}
          >
            <Text style={{ fontFamily: fonts.sansBold, fontSize: 11, color: 'rgba(255,255,255,0.6)', letterSpacing: 1.2, textTransform: 'uppercase' }}>
              Inversión 2026
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 6 }}>
              <Text style={{ fontFamily: fonts.mono, fontSize: 32, color: '#fff', letterSpacing: -1 }}>{fmtUsd(totalUsd)}</Text>
              <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
                USD · ≈ Bs.S {fmtKm(totalUsd * BS_RATE)}
              </Text>
            </View>

            {/* mini bar chart */}
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 50, marginTop: 14 }}>
              {SPEND_BARS.map((h, i) => (
                <View
                  key={i}
                  style={{
                    flex: 1,
                    height: `${(h / maxBar) * 100}%`,
                    backgroundColor: i === SPEND_BARS.length - 1 ? palette.accent2 : 'rgba(255,255,255,0.18)',
                    borderRadius: 3,
                  }}
                />
              ))}
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
              {['ENE', 'ABR', 'JUL', 'OCT', 'DIC'].map((m) => (
                <Text key={m} style={{ fontFamily: fonts.monoMed, fontSize: 10, color: 'rgba(255,255,255,0.6)' }}>
                  {m}
                </Text>
              ))}
            </View>
          </LinearGradient>
        </View>

        {/* lista */}
        <View style={{ paddingHorizontal: 16, gap: 10 }}>
          {changes.map((h) => {
            const v = vehicleOf(h.vehicleId);
            return (
              <Card key={h.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <VehicleThumb kind={v?.kind ?? 'car'} color={v?.color ?? '#1F2937'} size={42} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: fonts.sansBold, fontSize: 14, color: T.ink, letterSpacing: -0.1 }}>
                    {v ? `${v.brand} ${v.model}` : 'Vehículo'}
                  </Text>
                  <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: T.muted, marginTop: 1 }}>
                    <Text style={{ fontFamily: fonts.monoMed }}>{h.date}</Text> ·{' '}
                    <Text style={{ fontFamily: fonts.monoMed }}>{fmtKm(h.km)}</Text> km
                  </Text>
                  <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: T.muted2, marginTop: 1 }}>
                    {h.oil.brand} {h.oil.tag} {h.oil.viscosity}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontFamily: fonts.mono, fontSize: 14, color: T.ink }}>{fmtUsd(h.costUsd)}</Text>
                  <Text style={{ fontFamily: fonts.sans, fontSize: 10, color: T.muted2 }}>USD</Text>
                </View>
              </Card>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}
