// Detalle del vehículo — hero oscuro + card de aceite + timeline de historial
import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts, palette, T } from '../theme';
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
    <View style={{ flex: 1, backgroundColor: T.bg3 }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
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
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <IconBtn dark icon={<Icon name="chevL" color="#fff" size={20} />} onPress={() => navigation.goBack()} />
            <IconBtn dark icon={<Icon name="edit" color="#fff" size={20} />} />
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <VehicleThumb kind={vehicle.kind} color={vehicle.color} size={68} />
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                <VinPlate>{vehicle.plate}</VinPlate>
                <VinPlate>{vehicle.year}</VinPlate>
              </View>
              <Text style={{ fontFamily: fonts.display, fontSize: 26, color: '#fff', letterSpacing: -0.5 }}>
                {vehicle.brand} {vehicle.model}
              </Text>
              <Text style={{ fontFamily: fonts.sans, fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>
                {vehicle.kind === 'car' ? 'Carro' : 'Moto'} · {profile.city}, {profile.state}
              </Text>
            </View>
          </View>

          {/* mini stats */}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 18 }}>
            {[
              { l: 'Odómetro', v: fmtKm(vehicle.km), u: 'km' },
              { l: 'Vida aceite', v: `${pct}%`, u: '' },
              { l: 'Restan', v: fmtKm(kmLeft(vehicle)), u: 'km' },
            ].map((s) => (
              <View
                key={s.l}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                  borderRadius: 12,
                  backgroundColor: 'rgba(255,255,255,0.08)',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.1)',
                }}
              >
                <Text style={{ fontFamily: fonts.sansBold, fontSize: 9, letterSpacing: 1.2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)' }}>
                  {s.l}
                </Text>
                <Text style={{ fontFamily: fonts.mono, fontSize: 17, color: '#fff', marginTop: 2 }}>{s.v}</Text>
                {s.u ? <Text style={{ fontFamily: fonts.sans, fontSize: 10, color: 'rgba(255,255,255,0.55)' }}>{s.u}</Text> : null}
              </View>
            ))}
          </View>
        </LinearGradient>

        {/* oil card */}
        <View style={{ paddingHorizontal: 16, paddingTop: 18 }}>
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  backgroundColor: `${palette.accent}14`,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name="oil" color={palette.accent} size={22} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.sansBold, fontSize: 11, color: T.muted, letterSpacing: 1, textTransform: 'uppercase' }}>
                  Aceite actual
                </Text>
                <Text style={{ fontFamily: fonts.display, fontSize: 17, color: T.ink }}>
                  {vehicle.oil.brand} {vehicle.oil.tag}
                </Text>
              </View>
              <StatusPill status={status} />
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {[
                { l: 'Viscosidad', v: vehicle.oil.viscosity },
                { l: 'Último km', v: fmtKm(vehicle.lastChange) },
                { l: 'Próximo km', v: fmtKm(vehicle.nextChange) },
              ].map((c) => (
                <View key={c.l} style={{ flex: 1, paddingVertical: 10, borderTopWidth: 1, borderTopColor: T.line }}>
                  <Text style={{ fontFamily: fonts.sansBold, fontSize: 10, color: T.muted2, letterSpacing: 1, textTransform: 'uppercase' }}>
                    {c.l}
                  </Text>
                  <Text style={{ fontFamily: fonts.mono, fontSize: 15, color: T.ink, marginTop: 2 }}>{c.v}</Text>
                </View>
              ))}
            </View>
            <Btn
              kind="primary"
              size="md"
              style={{ marginTop: 12 }}
              icon={<Icon name="drop" color="#fff" size={18} />}
              onPress={() => navigation.navigate('AddOil', { vehicleId: vehicle.id })}
            >
              Registrar nuevo cambio
            </Btn>
          </Card>
        </View>

        {/* timeline historial */}
        <View style={{ paddingTop: 20 }}>
          <SectionHead>Historial de aceite</SectionHead>
          <View style={{ paddingHorizontal: 16 }}>
            {changes.map((h, i) => (
              <View key={h.id} style={{ flexDirection: 'row', gap: 14, paddingHorizontal: 4 }}>
                {/* línea de tiempo */}
                <View style={{ width: 24, alignItems: 'center' }}>
                  <View
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: 6,
                      backgroundColor: i === 0 ? palette.accent : T.bg2,
                      borderWidth: 2,
                      borderColor: i === 0 ? palette.accent : T.line,
                      marginTop: 18,
                    }}
                  />
                  {i < changes.length - 1 ? <View style={{ flex: 1, width: 2, backgroundColor: T.line, marginTop: 4 }} /> : null}
                </View>
                <Card style={{ flex: 1, marginBottom: 10 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <Text style={{ fontFamily: fonts.monoMed, fontSize: 12, color: T.muted }}>{h.date}</Text>
                    <Text style={{ fontFamily: fonts.mono, fontSize: 13, color: T.ink }}>{fmtKm(h.km)} km</Text>
                  </View>
                  <Text style={{ fontFamily: fonts.sansBold, fontSize: 14, color: T.ink }}>
                    {h.oil.brand} {h.oil.tag} {h.oil.viscosity}
                  </Text>
                  <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: T.muted, marginTop: 2 }}>
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
