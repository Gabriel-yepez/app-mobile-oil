// Perfil — hero oscuro con avatar + datos personales + preferencias + cerrar sesión
import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { fonts, palette, radius, T } from '../theme';
import { Card, IconBtn, SectionHead, TechGrid } from '../components/primitives';
import { Icon, IconName } from '../components/Icon';
import { useStore } from '../store/useStore';
import { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const profile = useStore((s) => s.profile);
  const vehicles = useStore((s) => s.vehicles);
  const changes = useStore((s) => s.changes);

  const initials = profile.fullName
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('');

  const personalRows = [
    { k: 'Correo', v: profile.email },
    { k: 'Teléfono', v: profile.phone, mono: true },
    { k: 'Estado', v: profile.state },
    { k: 'Ciudad', v: profile.city },
    { k: 'Moneda', v: 'USD · Bs.S' },
  ];

  const prefRows: { k: string; v: string; icon: IconName }[] = [
    { k: 'Notificaciones', v: 'Activadas', icon: 'bell' },
    { k: 'Unidad', v: 'Kilómetros', icon: 'gauge' },
    { k: 'Idioma', v: 'Español (VE)', icon: 'flag' },
    { k: 'Privacidad', v: '', icon: 'shield' },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: T.bg3 }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        {/* hero */}
        <LinearGradient
          colors={[palette.primary, palette.primary2]}
          style={{
            paddingTop: insets.top + 12,
            borderBottomLeftRadius: 28,
            borderBottomRightRadius: 28,
            overflow: 'hidden',
          }}
        >
          <TechGrid />
          <View
            style={{
              paddingHorizontal: 20,
              paddingBottom: 8,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: 'rgba(255,255,255,0.7)', letterSpacing: 1, textTransform: 'uppercase' }}>
              Perfil
            </Text>
            <IconBtn dark icon={<Icon name="edit" color="#fff" size={20} />} />
          </View>

          <View style={{ paddingHorizontal: 20, paddingBottom: 24, paddingTop: 8, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <LinearGradient
              colors={[palette.accent2, palette.primary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                width: 72,
                height: 72,
                borderRadius: 36,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 3,
                borderColor: 'rgba(255,255,255,0.2)',
              }}
            >
              <Text style={{ fontFamily: fonts.display, fontSize: 26, color: '#fff' }}>{initials}</Text>
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.display, fontSize: 22, color: '#fff', letterSpacing: -0.4 }}>
                {profile.fullName}
              </Text>
              <Text style={{ fontFamily: fonts.monoMed, fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>
                {profile.cedula}
              </Text>
              <View
                style={{
                  marginTop: 6,
                  alignSelf: 'flex-start',
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: radius.pill,
                  backgroundColor: 'rgba(255,255,255,0.1)',
                }}
              >
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: T.ok }} />
                <Text style={{ fontFamily: fonts.sansSemi, fontSize: 11, color: '#fff' }}>Cuenta verificada</Text>
              </View>
            </View>
          </View>

          {/* mini stats */}
          <View style={{ paddingHorizontal: 20, paddingBottom: 24, flexDirection: 'row', gap: 8 }}>
            {[
              { l: 'Vehículos', v: String(vehicles.length) },
              { l: 'Cambios', v: String(changes.length) },
              { l: 'Activo', v: '8m' },
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
                  borderColor: 'rgba(255,255,255,0.08)',
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontFamily: fonts.mono, fontSize: 18, color: '#fff' }}>{s.v}</Text>
                <Text style={{ fontFamily: fonts.sans, fontSize: 10, color: 'rgba(255,255,255,0.65)', letterSpacing: 1, textTransform: 'uppercase' }}>
                  {s.l}
                </Text>
              </View>
            ))}
          </View>
        </LinearGradient>

        {/* datos personales */}
        <View style={{ paddingTop: 18 }}>
          <SectionHead>Datos personales</SectionHead>
          <View style={{ paddingHorizontal: 16 }}>
            <Card>
              {personalRows.map((r, i) => (
                <View
                  key={r.k}
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingVertical: 12,
                    borderBottomWidth: i === personalRows.length - 1 ? 0 : 1,
                    borderBottomColor: T.line2,
                  }}
                >
                  <Text style={{ fontFamily: fonts.sans, fontSize: 13, color: T.muted }}>{r.k}</Text>
                  <Text style={{ fontFamily: r.mono ? fonts.monoMed : fonts.sansSemi, fontSize: 14, color: T.ink }}>
                    {r.v}
                  </Text>
                </View>
              ))}
            </Card>
          </View>
        </View>

        {/* preferencias */}
        <View style={{ paddingTop: 18 }}>
          <SectionHead>Preferencias</SectionHead>
          <View style={{ paddingHorizontal: 16 }}>
            <Card padded={false}>
              {prefRows.map((r, i) => (
                <Pressable
                  key={r.k}
                  style={({ pressed }) => [
                    {
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                      paddingVertical: 14,
                      paddingHorizontal: 16,
                      borderBottomWidth: i === prefRows.length - 1 ? 0 : 1,
                      borderBottomColor: T.line2,
                    },
                    pressed && { backgroundColor: T.bg2 },
                  ]}
                >
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 10,
                      backgroundColor: `${palette.accent}14`,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon name={r.icon} color={palette.accent} size={18} />
                  </View>
                  <Text style={{ flex: 1, fontFamily: fonts.sansSemi, fontSize: 14, color: T.ink }}>{r.k}</Text>
                  {r.v ? <Text style={{ fontFamily: fonts.sans, fontSize: 13, color: T.muted }}>{r.v}</Text> : null}
                  <Icon name="chevR" color={T.muted2} size={20} />
                </Pressable>
              ))}
            </Card>
          </View>
        </View>

        {/* cerrar sesión */}
        <View style={{ paddingTop: 18, paddingHorizontal: 16 }}>
          <Pressable
            onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Login' }] })}
            style={({ pressed }) => ({
              height: 48,
              borderRadius: radius.md,
              borderWidth: 1.5,
              borderColor: T.line,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              backgroundColor: pressed ? T.bg2 : 'transparent',
            })}
          >
            <Icon name="logout" color={T.danger} size={20} />
            <Text style={{ fontFamily: fonts.sansSemi, fontSize: 15, color: T.danger }}>Cerrar sesión</Text>
          </Pressable>
          <Text style={{ textAlign: 'center', marginTop: 12, fontFamily: fonts.monoMed, fontSize: 11, color: T.muted2, letterSpacing: 0.4 }}>
            OilTrack VE · v1.0.0
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
