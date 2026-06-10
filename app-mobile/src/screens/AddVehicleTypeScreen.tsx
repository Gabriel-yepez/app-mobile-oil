// Agregar vehículo — Paso 1/3: elegir Carro o Moto
import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts, palette, radius, T } from '../theme';
import { Btn, IconBtn } from '../components/primitives';
import { Icon } from '../components/Icon';
import { RootScreenProps } from '../navigation/types';

type Kind = 'car' | 'moto';

const OPTIONS: { kind: Kind; title: string; subtitle: string; gradient: [string, string] }[] = [
  { kind: 'car', title: 'Carro', subtitle: 'Sedán, hatchback, SUV, camioneta…', gradient: [palette.accent2, palette.primary] },
  { kind: 'moto', title: 'Moto', subtitle: 'Bera, Empire, MD, Yamaha, Suzuki…', gradient: ['#DC2626', '#7F1D1D'] },
];

export function AddVehicleTypeScreen({ navigation }: RootScreenProps<'AddVehicleType'>) {
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<Kind>('car');

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      {/* header */}
      <View
        style={{
          paddingTop: insets.top + 12,
          paddingHorizontal: 20,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <IconBtn icon={<Icon name="chevL" color={T.ink} size={20} />} onPress={() => navigation.goBack()} />
        <Text style={{ fontFamily: fonts.mono, fontSize: 11, color: T.muted, letterSpacing: 1 }}>PASO 1 / 3</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 8 }}>
        <Text style={{ fontFamily: fonts.display, fontSize: 30, color: T.ink, letterSpacing: -0.6, lineHeight: 33 }}>
          ¿Qué vas a registrar?
        </Text>
        <Text style={{ marginTop: 8, color: T.muted, fontFamily: fonts.sans, fontSize: 15 }}>
          Elige el tipo de vehículo para comenzar.
        </Text>
      </View>

      <View style={{ paddingHorizontal: 20, paddingVertical: 24, gap: 14 }}>
        {OPTIONS.map((o) => {
          const isSelected = selected === o.kind;
          return (
            <Pressable
              key={o.kind}
              onPress={() => setSelected(o.kind)}
              style={{
                padding: 18,
                borderRadius: radius.lg,
                borderWidth: isSelected ? 2 : 1.5,
                borderColor: isSelected ? palette.accent : T.line,
                backgroundColor: '#fff',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 16,
                shadowColor: isSelected ? palette.accent : '#0A2540',
                shadowOffset: { width: 0, height: isSelected ? 0 : 8 },
                shadowOpacity: isSelected ? 0.18 : 0.06,
                shadowRadius: isSelected ? 8 : 24,
                elevation: isSelected ? 4 : 2,
              }}
            >
              <LinearGradient
                colors={o.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ width: 72, height: 72, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }}
              >
                <Icon name={o.kind === 'car' ? 'car' : 'moto'} color="#fff" size={36} />
              </LinearGradient>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.display, fontSize: 20, color: T.ink, letterSpacing: -0.3 }}>{o.title}</Text>
                <Text style={{ fontFamily: fonts.sans, fontSize: 13, color: T.muted, marginTop: 2 }}>{o.subtitle}</Text>
              </View>
              {isSelected ? (
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    backgroundColor: palette.accent,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon name="check" color="#fff" size={18} />
                </View>
              ) : (
                <View style={{ width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: T.line }} />
              )}
            </Pressable>
          );
        })}
      </View>

      {/* helper */}
      <View
        style={{
          marginHorizontal: 20,
          padding: 14,
          borderRadius: 14,
          backgroundColor: T.bg2,
          flexDirection: 'row',
          gap: 10,
          alignItems: 'flex-start',
        }}
      >
        <View style={{ marginTop: 2 }}>
          <Icon name="shield" color={palette.accent} size={20} />
        </View>
        <Text style={{ flex: 1, fontFamily: fonts.sans, fontSize: 13, color: T.muted, lineHeight: 19.5 }}>
          Podrás registrar tantos vehículos como quieras. Tu información se guarda solo en tu cuenta.
        </Text>
      </View>

      <View style={{ flex: 1 }} />
      <View style={{ paddingHorizontal: 20, paddingBottom: Math.max(insets.bottom, 24) + 12 }}>
        <Btn
          kind="primary"
          size="lg"
          icon={<Icon name="arrow" color="#fff" size={18} />}
          onPress={() => navigation.navigate('AddVehicleForm', { kind: selected })}
        >
          Continuar
        </Btn>
      </View>
    </View>
  );
}
