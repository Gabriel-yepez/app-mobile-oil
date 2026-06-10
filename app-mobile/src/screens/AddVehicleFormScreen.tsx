// Agregar vehículo — Paso 2/3: marca, modelo, año, color, placa, km actual
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts, palette, radius, T } from '../theme';
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
      <View style={{ flex: 1, backgroundColor: T.bg3 }}>
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
          <Text style={{ fontFamily: fonts.mono, fontSize: 11, color: T.muted, letterSpacing: 1 }}>PASO 2 / 3</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 140 }}>
          <View style={{ paddingHorizontal: 24, paddingTop: 20, paddingBottom: 8 }}>
            <Text style={{ fontFamily: fonts.display, fontSize: 26, color: T.ink, letterSpacing: -0.5, lineHeight: 30 }}>
              Datos del vehículo
            </Text>
            <Text style={{ marginTop: 6, color: T.muted, fontFamily: fonts.sans, fontSize: 14 }}>
              Identifica tu {kind === 'car' ? 'carro' : 'moto'} para llevar el registro.
            </Text>
          </View>

          <View style={{ paddingHorizontal: 20, paddingTop: 20 }}>
            <Card style={{ gap: 14 }}>
              <Field label="Marca">
                <Select value={brand} placeholder="Selecciona la marca" options={brands} onChange={setBrand} />
              </Field>
              <Field label="Modelo">
                <Input value={model} onChangeText={setModel} placeholder="Corolla XEI" />
              </Field>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Field label="Año">
                    <Input value={year} onChangeText={setYear} placeholder="2019" mono keyboardType="number-pad" maxLength={4} />
                  </Field>
                </View>
                <View style={{ flex: 1 }}>
                  <Field label="Color">
                    <Pressable
                      onPress={() => setColorIdx((i) => (i + 1) % COLORS.length)}
                      style={{
                        height: 52,
                        borderRadius: radius.md,
                        borderWidth: 1.5,
                        borderColor: T.line,
                        backgroundColor: '#fff',
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingHorizontal: 14,
                        gap: 8,
                      }}
                    >
                      <View
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 11,
                          backgroundColor: color.hex,
                          borderWidth: 2,
                          borderColor: '#fff',
                          shadowColor: '#000',
                          shadowOpacity: 0.15,
                          shadowRadius: 2,
                          shadowOffset: { width: 0, height: 1 },
                          elevation: 1,
                        }}
                      />
                      <Text style={{ fontFamily: fonts.sans, fontSize: 14, color: T.ink }}>{color.name}</Text>
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
                  right={<Text style={{ fontFamily: fonts.monoMed, fontSize: 12, color: T.muted }}>km</Text>}
                />
              </Field>
            </Card>
          </View>
        </ScrollView>

        <View
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            paddingHorizontal: 20,
            paddingTop: 16,
            paddingBottom: Math.max(insets.bottom, 24) + 12,
            backgroundColor: '#fff',
          }}
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
