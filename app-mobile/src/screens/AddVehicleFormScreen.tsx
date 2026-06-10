// Agregar vehículo — Paso 2/3: marca, modelo, año, color, placa, km actual
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Pressable, ScrollView, Text, View } from '../tw';
import { T } from '../theme';
import { Btn, Card, Field, IconBtn, Input, Select } from '../components/primitives';
import { Icon } from '../components/Icon';
import { VE_BRANDS_CAR, VE_BRANDS_MOTO } from '../data/mock';
import { RootScreenProps } from '../navigation/types';

const COLORS: { name: string; hex: string }[] = [
  { name: 'Negro', hex: '#1F2937' },
  { name: 'Gris', hex: '#9CA3AF' },
  { name: 'Blanco', hex: '#F3F4F6' },
  { name: 'Rojo', hex: '#DC2626' },
  { name: 'Azul', hex: '#2563EB' },
  { name: 'Verde', hex: '#059669' },
];

export function AddVehicleFormScreen({ navigation, route }: RootScreenProps<'AddVehicleForm'>) {
  const insets = useSafeAreaInsets();
  const { kind } = route.params;
  const brands = kind === 'car' ? VE_BRANDS_CAR : VE_BRANDS_MOTO;

  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [colorIdx, setColorIdx] = useState(0);
  const [plate, setPlate] = useState('');
  const [km, setKm] = useState('');

  const color = COLORS[colorIdx];

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View className="flex-1 bg-bg3">
        {/* header */}
        <View
          className="flex-row items-center justify-between px-5"
          style={{ paddingTop: insets.top + 12 }}
        >
          <IconBtn icon={<Icon name="chevL" color={T.ink} size={20} />} onPress={() => navigation.goBack()} />
          <Text className="font-mono text-[11px] text-muted tracking-[1px]">PASO 2 / 3</Text>
          <View className="w-9" />
        </View>

        <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="pb-[140px]">
          <View className="px-6 pb-2 pt-5">
            <Text className="font-display text-[26px] leading-[30px] text-ink tracking-[-0.5px]">
              Datos del vehículo
            </Text>
            <Text className="mt-1.5 font-sans text-[14px] text-muted">
              Identifica tu {kind === 'car' ? 'carro' : 'moto'} para llevar el registro.
            </Text>
          </View>

          <View className="px-5 pt-5">
            <Card className="gap-3.5">
              <Field label="Marca">
                <Select value={brand} placeholder="Selecciona la marca" options={brands} onChange={setBrand} />
              </Field>
              <Field label="Modelo">
                <Input value={model} onChangeText={setModel} placeholder="Corolla XEI" />
              </Field>
              <View className="flex-row gap-3">
                <View className="flex-1">
                  <Field label="Año">
                    <Input value={year} onChangeText={setYear} placeholder="2019" mono keyboardType="number-pad" maxLength={4} />
                  </Field>
                </View>
                <View className="flex-1">
                  <Field label="Color">
                    <Pressable
                      onPress={() => setColorIdx((i) => (i + 1) % COLORS.length)}
                      className="h-[52px] flex-row items-center gap-2 rounded-md border-[1.5px] border-line bg-white px-3.5"
                    >
                      <View
                        className="h-[22px] w-[22px] rounded-full border-2 border-white shadow-[0px_1px_2px_rgba(0,0,0,0.15)]"
                        style={{ backgroundColor: color.hex }}
                      />
                      <Text className="font-sans text-[14px] text-ink">{color.name}</Text>
                    </Pressable>
                  </Field>
                </View>
              </View>
              <Field label="Placa" suffix="formato VE">
                <Input value={plate} onChangeText={(t) => setPlate(t.toUpperCase())} placeholder={kind === 'car' ? 'AC123BD' : 'AAB12P'} mono autoCapitalize="characters" />
              </Field>
              <Field label="Kilometraje actual" suffix="km">
                <Input
                  value={km}
                  onChangeText={setKm}
                  placeholder="78460"
                  mono
                  keyboardType="number-pad"
                  right={<Text className="font-mono-med text-[12px] text-muted">km</Text>}
                />
              </Field>
            </Card>
          </View>
        </ScrollView>

        <View
          className="absolute bottom-0 left-0 right-0 bg-white px-5 pt-4"
          style={{ paddingBottom: Math.max(insets.bottom, 24) + 12 }}
        >
          <Btn
            kind="primary"
            size="lg"
            icon={<Icon name="arrow" color="#fff" size={18} />}
            onPress={() =>
              navigation.navigate('AddOil', {
                draft: {
                  kind,
                  brand: brand || brands[0],
                  model: model || 'Sin modelo',
                  year: parseInt(year, 10) || new Date().getFullYear(),
                  plate: plate || '—',
                  color: color.hex,
                  km: parseInt(km, 10) || 0,
                },
              })
            }
          >
            Siguiente: Aceite
          </Btn>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
