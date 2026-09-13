// Agregar vehículo — Paso 2/3: marca, modelo, año, color, placa, km actual
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Box, Col, Row, Scroll, Touchable, Txt, useAppColors } from '../ui';
import { Btn, Card, Field, IconBtn, Input, Select } from '../components/primitives';
import { StepHeader } from '../components/StepHeader';
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
  const c = useAppColors();
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
      <Box f={1} bg="$bg3">
        <StepHeader step={2} total={3} onBack={() => navigation.goBack()} />

        <Scroll bg="$bg3" keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 140 }}>
          <Col px="$2xl" pb="$sm" pt="$xl">
            <Txt font="display" fos={26} lh={30} ls={-0.5}>
              Datos del vehículo
            </Txt>
            <Txt fos={14} tone="muted" mt={6}>
              Identifica tu {kind === 'car' ? 'carro' : 'moto'} para llevar el registro.
            </Txt>
          </Col>

          <Box px="$xl" pt="$xl">
            <Card gap={14}>
              <Field label="Marca">
                <Select value={brand} placeholder="Selecciona la marca" options={brands} onChange={setBrand} />
              </Field>
              <Field label="Modelo">
                <Input value={model} onChangeText={setModel} placeholder="Corolla XEI" />
              </Field>
              <Row gap="$md" ai="flex-start">
                <Box f={1}>
                  <Field label="Año">
                    <Input value={year} onChangeText={setYear} placeholder="2019" mono keyboardType="number-pad" maxLength={4} />
                  </Field>
                </Box>
                <Box f={1}>
                  <Field label="Color">
                    <Touchable
                      onPress={() => setColorIdx((i) => (i + 1) % COLORS.length)}
                      fade
                      fd="row"
                      ai="center"
                      h={52}
                      gap="$sm"
                      br="$md"
                      bw={1.5}
                      bc="$line"
                      bg="$surface"
                      px={14}
                    >
                      <Box
                        h={22}
                        w={22}
                        br="$pill"
                        bw={2}
                        bc="#FFFFFF"
                        bg={color.hex}
                        transition="quick"
                        shadowColor="#000000"
                        shadowOpacity={0.15}
                        shadowRadius={2}
                        shadowOffset={{ width: 0, height: 1 }}
                      />
                      <Txt fos={14}>{color.name}</Txt>
                    </Touchable>
                  </Field>
                </Box>
              </Row>
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
                  right={<Txt font="monoMed" fos={12} tone="muted">km</Txt>}
                />
              </Field>
            </Card>
          </Box>
        </Scroll>

        <Box pos="absolute" b={0} l={0} r={0} bg="$bg" px="$xl" pt="$lg" pb={Math.max(insets.bottom, 24) + 12}>
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
        </Box>
      </Box>
    </KeyboardAvoidingView>
  );
}
