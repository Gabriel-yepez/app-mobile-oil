// Agregar vehículo — Paso 2/3: marca, modelo, año, color, placa, km actual
import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Box, Col, Row, Scroll, Touchable, Txt, useAppColors } from '../ui';
import { Btn, Card, Field, IconBtn, Input, Select } from '../components/primitives';
import { StepHeader } from '../components/StepHeader';
import { Icon } from '../components/Icon';
import { useBrands, useMarcasDe } from '../store/useBrands';
import { nombreValido, sugerirParecida } from '../data/marcas/nombre';
import { ColorSelect } from '../components/ColorSelect';
import { useColors } from '../store/useColors';
import { RootScreenProps } from '../navigation/types';

export function AddVehicleFormScreen({ navigation, route }: RootScreenProps<'AddVehicleForm'>) {
  const insets = useSafeAreaInsets();
  const c = useAppColors();
  const { kind } = route.params;
  const brands = useMarcasDe(kind);
  const agregarMarca = useBrands((s) => s.agregar);

  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  // El hex y no un índice: es lo que se guarda y lo que el catálogo puede
  // dejar de tener. Arranca en el primero del catálogo.
  const primerColor = useColors((st) => st.colores[0]?.hex ?? '#1F2937');
  const [color, setColor] = useState(primerColor);
  const [plate, setPlate] = useState('');
  const [km, setKm] = useState('');
  // Default de 1.200 km/mes: 40 km/día, el uso urbano típico en Venezuela.
  const [kmMes, setKmMes] = useState('1200');


  const pedirMarcaNueva = (texto: string) => {
    if (!nombreValido(texto)) {
      Alert.alert(
        'Ese nombre no sirve',
        'Usa letras, números, espacios, punto o guion. Máximo 40 caracteres.',
      );
      return;
    }

    const parecida = sugerirParecida(texto, brands);
    if (parecida) {
      Alert.alert(`¿Quisiste decir ${parecida}?`, `Escribiste «${texto}».`, [
        { text: `Usar ${parecida}`, onPress: () => setBrand(parecida) },
        {
          text: `Crear «${texto}»`,
          style: 'destructive',
          onPress: () => {
            agregarMarca(kind, texto);
            setBrand(texto);
          },
        },
      ]);
      return;
    }

    agregarMarca(kind, texto);
    setBrand(texto);
  };

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
                <Select
                  value={brand}
                  placeholder="Selecciona la marca"
                  options={brands}
                  onChange={setBrand}
                  searchable
                  onAddNew={pedirMarcaNueva}
                />
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
                    <ColorSelect value={color} onChange={setColor} />
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
              {/* Sin esto la barra se congelaría entre cambio y cambio: el
                  odómetro solo existe sentado en el auto, así que se proyecta
                  con este ritmo y se corrige cuando el usuario lo reporta. */}
              <Field label="¿Cuánto manejas normalmente?" suffix="km al mes">
                <Input
                  value={kmMes}
                  onChangeText={setKmMes}
                  placeholder="1200"
                  mono
                  keyboardType="number-pad"
                  right={<Txt font="monoMed" fos={12} tone="muted">km/mes</Txt>}
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
                  color,
                  km: parseInt(km, 10) || 0,
                  // Cuánto maneja, para que la barra baje sola entre cambios.
                  // Se pregunta en km/mes, que es como la gente sabe cuánto
                  // maneja; el backend piensa en km/día.
                  kmPerDay: Math.min(
                    500,
                    Math.max(1, Math.round(((parseInt(kmMes, 10) || 1200) / 30) * 100) / 100),
                  ),
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
