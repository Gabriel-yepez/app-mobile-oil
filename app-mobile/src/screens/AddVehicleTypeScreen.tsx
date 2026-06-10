// Agregar vehículo — Paso 1/3: elegir Carro o Moto
import React, { useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import clsx from 'clsx';
import { Pressable, Text, View } from '../tw';
import { palette, T } from '../theme';
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
    <View className="flex-1 bg-white">
      {/* header */}
      <View
        className="flex-row items-center justify-between px-5"
        style={{ paddingTop: insets.top + 12 }}
      >
        <IconBtn icon={<Icon name="chevL" color={T.ink} size={20} />} onPress={() => navigation.goBack()} />
        <Text className="font-mono text-[11px] text-muted tracking-[1px]">PASO 1 / 3</Text>
        <View className="w-9" />
      </View>

      <View className="px-6 pb-2 pt-6">
        <Text className="font-display text-[30px] leading-[33px] text-ink tracking-[-0.6px]">
          ¿Qué vas a registrar?
        </Text>
        <Text className="mt-2 font-sans text-[15px] text-muted">
          Elige el tipo de vehículo para comenzar.
        </Text>
      </View>

      <View className="gap-3.5 px-5 py-6">
        {OPTIONS.map((o) => {
          const isSelected = selected === o.kind;
          return (
            <Pressable
              key={o.kind}
              onPress={() => setSelected(o.kind)}
              className={clsx(
                'flex-row items-center gap-4 rounded-lg bg-white p-[18px]',
                isSelected
                  ? 'border-2 border-accent shadow-[0px_0px_8px_rgba(37,99,235,0.18)]'
                  : 'border-[1.5px] border-line shadow-card'
              )}
            >
              <LinearGradient
                colors={o.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ width: 72, height: 72, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }}
              >
                <Icon name={o.kind === 'car' ? 'car' : 'moto'} color="#fff" size={36} />
              </LinearGradient>
              <View className="flex-1">
                <Text className="font-display text-[20px] text-ink tracking-[-0.3px]">{o.title}</Text>
                <Text className="mt-0.5 font-sans text-[13px] text-muted">{o.subtitle}</Text>
              </View>
              {isSelected ? (
                <View className="h-7 w-7 items-center justify-center rounded-full bg-accent">
                  <Icon name="check" color="#fff" size={18} />
                </View>
              ) : (
                <View className="h-7 w-7 rounded-full border-2 border-line" />
              )}
            </Pressable>
          );
        })}
      </View>

      {/* helper */}
      <View className="mx-5 flex-row items-start gap-2.5 rounded-[14px] bg-bg2 p-3.5">
        <View className="mt-0.5">
          <Icon name="shield" color={palette.accent} size={20} />
        </View>
        <Text className="flex-1 font-sans text-[13px] leading-[19.5px] text-muted">
          Podrás registrar tantos vehículos como quieras. Tu información se guarda solo en tu cuenta.
        </Text>
      </View>

      <View className="flex-1" />
      <View className="px-5" style={{ paddingBottom: Math.max(insets.bottom, 24) + 12 }}>
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
