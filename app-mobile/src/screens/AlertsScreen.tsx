// Alertas — agrupadas por estado: crítica (vencido), warning (próximo) y resueltas
import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { fonts, palette, radius, shadow, T } from '../theme';
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
            Alertas
          </Text>
          <Text style={{ fontFamily: fonts.display, fontSize: 26, color: T.ink, letterSpacing: -0.5 }}>
            {open} abiertas
          </Text>
        </View>
        <IconBtn icon={<Icon name="settings" color={T.ink} size={20} />} size={40} />
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120, gap: 12 }} showsVerticalScrollIndicator={false}>
        {/* críticas: vencido */}
        {overdue.map((v) => (
          <View
            key={v.id}
            style={[
              {
                borderRadius: radius.lg,
                borderWidth: 1.5,
                borderColor: `${T.danger}33`,
                overflow: 'hidden',
              },
              shadow.card,
            ]}
          >
            <LinearGradient colors={['#FEF2F2', '#ffffff']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    backgroundColor: T.danger,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon name="bell" color="#fff" size={20} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: fonts.sansBold, fontSize: 11, color: T.danger, letterSpacing: 1.2, textTransform: 'uppercase' }}>
                    Cambio vencido
                  </Text>
                  <Text style={{ fontFamily: fonts.display, fontSize: 17, color: T.ink }}>
                    {v.brand} {v.model}
                  </Text>
                </View>
              </View>
              <Text style={{ fontFamily: fonts.sans, fontSize: 13, color: T.muted, lineHeight: 19.5 }}>
                Has superado el kilometraje recomendado. Excedido por{' '}
                <Text style={{ fontFamily: fonts.mono, color: T.danger }}>+{fmtKm(Math.abs(kmLeft(v)))} km</Text>.
              </Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                <Btn
                  kind="primary"
                  size="sm"
                  style={{ flex: 1, backgroundColor: T.danger }}
                  onPress={() => navigation.navigate('AddOil', { vehicleId: v.id })}
                >
                  Registrar cambio
                </Btn>
                <Btn kind="ghost" size="sm" style={{ flex: 1 }}>
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
            style={[
              {
                borderRadius: radius.lg,
                borderWidth: 1.5,
                borderColor: `${T.warn}33`,
                overflow: 'hidden',
              },
              shadow.card,
            ]}
          >
            <LinearGradient colors={['#FFFBEB', '#ffffff']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    backgroundColor: T.warn,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon name="gauge" color="#fff" size={20} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: fonts.sansBold, fontSize: 11, color: '#B45309', letterSpacing: 1.2, textTransform: 'uppercase' }}>
                    Próximo cambio
                  </Text>
                  <Text style={{ fontFamily: fonts.display, fontSize: 17, color: T.ink }}>
                    {v.brand} {v.model}
                  </Text>
                </View>
              </View>
              <Text style={{ fontFamily: fonts.sans, fontSize: 13, color: T.muted, lineHeight: 19.5 }}>
                Restan <Text style={{ fontFamily: fonts.mono, color: '#B45309' }}>{fmtKm(kmLeft(v))} km</Text> para el próximo
                cambio. Programa tu visita al lubricentro.
              </Text>
            </LinearGradient>
          </View>
        ))}

        {/* resueltas */}
        <View style={{ marginTop: 8, marginHorizontal: -16 }}>
          <SectionHead>Resueltas</SectionHead>
        </View>
        {RESOLVED.map((r, i) => (
          <Card key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                backgroundColor: '#ECFDF5',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="check" color={T.ok} size={18} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.sansBold, fontSize: 14, color: T.ink }}>{r.v}</Text>
              <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: T.muted, marginTop: 1 }}>{r.text}</Text>
            </View>
            <Text style={{ fontFamily: fonts.monoMed, fontSize: 11, color: T.muted2 }}>{r.date}</Text>
          </Card>
        ))}
      </ScrollView>
    </View>
  );
}
