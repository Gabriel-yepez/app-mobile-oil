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
import { fmtKm } from '../utils/format';

// Sin un ritmo la barra se congelaría entre cambio y cambio: el odómetro
// solo existe sentado en el auto, así que se proyecta con este aproximado y
// el backend lo reemplaza por el medido cuando el usuario reporta lecturas.
// Casi nadie sabe el número exacto, por eso se ofrecen perfiles de uso.
const PERFILES_USO = [
  { label: 'Poco', kmMes: 500 },
  { label: 'Normal', kmMes: 1200 },
  { label: 'Bastante', kmMes: 2000 },
  { label: 'Mucho', kmMes: 3000 },
];
// 1.200 km/mes: 40 km/día, el uso urbano típico en Venezuela.
const KM_MES_INICIAL = 1200;

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
  const [kmMes, setKmMes] = useState(String(KM_MES_INICIAL));
  const kmMesNum = parseInt(kmMes, 10) || 0;
  // El backend piensa en km/día y lo valida en [1, 500].
  const kmPorDia = Math.min(500, Math.max(1, Math.round(((kmMesNum || KM_MES_INICIAL) / 30) * 100) / 100));

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
                  nuevo="una marca nueva"
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
                    <ColorSelect
                      value={color}
                      onChange={setColor}
                      vehiculo={{ kind, brand, model, plate, year: parseInt(year, 10) || new Date().getFullYear() }}
                    />
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

          {/* El asesor: el mismo dato de siempre, pero pedido como consejo y
              no como un campo más. Se nota que es aproximado y para qué sirve. */}
          <Box px="$xl" pt="$md">
            <Card gap={14} bc="$accent" bw={1.5}>
              <Row gap="$md" ai="flex-start">
                <Box h={40} w={40} br="$pill" ai="center" jc="center" bg="$accentSoft">
                  <Icon name="spark" color={c.accent} size={20} />
                </Box>
                <Col f={1} gap={4}>
                  <Txt font="bold" fos={11} tone="accent" ls={1.2} caps>
                    Tu asesor
                  </Txt>
                  <Txt font="semi" fos={16} lh={21}>
                    ¿Cuánto manejas al mes, más o menos?
                  </Txt>
                  <Txt fos={13} lh={18} tone="muted">
                    Con eso calculo cuándo te toca el próximo cambio, aunque no me
                    reportes el kilometraje. No tiene que ser exacto.
                  </Txt>
                </Col>
              </Row>

              <Row gap="$sm">
                {PERFILES_USO.map((p) => {
                  const activo = kmMesNum === p.kmMes;
                  return (
                    <Touchable
                      key={p.label}
                      f={1}
                      onPress={() => setKmMes(String(p.kmMes))}
                      fade
                      ai="center"
                      py={8}
                      br="$md"
                      bw={1}
                      bc={activo ? '$accent' : '$line'}
                      bg={activo ? '$accentSoft' : 'transparent'}
                    >
                      <Txt font="semi" fos={12} tone={activo ? 'accent' : 'ink'}>
                        {p.label}
                      </Txt>
                      <Txt font="monoMed" fos={10} tone={activo ? 'accent' : 'muted2'}>
                        {fmtKm(p.kmMes)}
                      </Txt>
                    </Touchable>
                  );
                })}
              </Row>

              <Input
                value={kmMes}
                onChangeText={setKmMes}
                placeholder={String(KM_MES_INICIAL)}
                mono
                keyboardType="number-pad"
                maxLength={5}
                prefix="≈"
                right={<Txt font="monoMed" fos={12} tone="muted">km/mes</Txt>}
              />

              <Row gap="$sm" ai="center" br="$md" bg="$bg2" px="$md" py="$sm">
                <Icon name="gauge" color={c.muted} size={16} />
                <Txt f={1} fos={12} lh={17} tone="muted">
                  Unos <Txt font="monoMed" fos={12}>{fmtKm(Math.round(kmPorDia))}</Txt> km al día. Si luego
                  me reportas el odómetro, ajusto el cálculo solo.
                </Txt>
              </Row>
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
                  kmPerDay: kmPorDia,
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
