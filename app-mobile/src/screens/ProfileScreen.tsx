// Perfil — hero oscuro con avatar + datos personales + preferencias + cerrar sesión
import React from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import clsx from 'clsx';
import { Pressable, ScrollView, Text, View } from '../tw';
import { palette, T } from '../theme';
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
    <View className="flex-1 bg-bg3">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-[120px]">
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
          <View className="flex-row items-center justify-between px-5 pb-2">
            <Text className="font-sans text-[12px] text-[rgba(255,255,255,0.7)] tracking-[1px] uppercase">
              Perfil
            </Text>
            <IconBtn dark icon={<Icon name="edit" color="#fff" size={20} />} />
          </View>

          <View className="flex-row items-center gap-3.5 px-5 pb-6 pt-2">
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
              <Text className="font-display text-[26px] text-white">{initials}</Text>
            </LinearGradient>
            <View className="flex-1">
              <Text className="font-display text-[22px] text-white tracking-[-0.4px]">
                {profile.fullName}
              </Text>
              <Text className="mt-0.5 font-mono-med text-[12px] text-[rgba(255,255,255,0.7)]">
                {profile.cedula}
              </Text>
              <View className="mt-1.5 flex-row items-center gap-1.5 self-start rounded-full bg-[rgba(255,255,255,0.1)] px-2 py-[3px]">
                <View className="h-1.5 w-1.5 rounded-full bg-ok" />
                <Text className="font-sans-semi text-[11px] text-white">Cuenta verificada</Text>
              </View>
            </View>
          </View>

          {/* mini stats */}
          <View className="flex-row gap-2 px-5 pb-6">
            {[
              { l: 'Vehículos', v: String(vehicles.length) },
              { l: 'Cambios', v: String(changes.length) },
              { l: 'Activo', v: '8m' },
            ].map((s) => (
              <View
                key={s.l}
                className="flex-1 items-center rounded-[12px] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.08)] px-3 py-2.5"
              >
                <Text className="font-mono text-[18px] text-white">{s.v}</Text>
                <Text className="font-sans text-[10px] text-[rgba(255,255,255,0.65)] tracking-[1px] uppercase">
                  {s.l}
                </Text>
              </View>
            ))}
          </View>
        </LinearGradient>

        {/* datos personales */}
        <View className="pt-[18px]">
          <SectionHead>Datos personales</SectionHead>
          <View className="px-4">
            <Card>
              {personalRows.map((r, i) => (
                <View
                  key={r.k}
                  className={clsx(
                    'flex-row items-center justify-between py-3',
                    i !== personalRows.length - 1 && 'border-b border-line2'
                  )}
                >
                  <Text className="font-sans text-[13px] text-muted">{r.k}</Text>
                  <Text className={clsx('text-[14px] text-ink', r.mono ? 'font-mono-med' : 'font-sans-semi')}>
                    {r.v}
                  </Text>
                </View>
              ))}
            </Card>
          </View>
        </View>

        {/* preferencias */}
        <View className="pt-[18px]">
          <SectionHead>Preferencias</SectionHead>
          <View className="px-4">
            <Card padded={false}>
              {prefRows.map((r, i) => (
                <Pressable
                  key={r.k}
                  className={clsx(
                    'flex-row items-center gap-3 px-4 py-3.5 active:bg-bg2',
                    i !== prefRows.length - 1 && 'border-b border-line2'
                  )}
                >
                  <View className="h-8 w-8 items-center justify-center rounded-[10px] bg-[rgba(37,99,235,0.08)]">
                    <Icon name={r.icon} color={palette.accent} size={18} />
                  </View>
                  <Text className="flex-1 font-sans-semi text-[14px] text-ink">{r.k}</Text>
                  {r.v ? <Text className="font-sans text-[13px] text-muted">{r.v}</Text> : null}
                  <Icon name="chevR" color={T.muted2} size={20} />
                </Pressable>
              ))}
            </Card>
          </View>
        </View>

        {/* cerrar sesión */}
        <View className="px-4 pt-[18px]">
          <Pressable
            onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Login' }] })}
            className="h-12 flex-row items-center justify-center gap-2 rounded-md border-[1.5px] border-line bg-transparent active:bg-bg2"
          >
            <Icon name="logout" color={T.danger} size={20} />
            <Text className="font-sans-semi text-[15px] text-danger">Cerrar sesión</Text>
          </Pressable>
          <Text className="mt-3 text-center font-mono-med text-[11px] text-muted2 tracking-[0.4px]">
            OilTrack VE · v1.0.0
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
