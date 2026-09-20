// Registrar cambio de aceite — también es el Paso 3/3 del flujo agregar vehículo
import React, { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Box, Col, Row, Scroll, Touchable, Txt, useAppColors, useShadows } from '../ui';
import { Btn, Card, Field, IconBtn, Input, Select } from '../components/primitives';
import { StepHeader } from '../components/StepHeader';
import { Icon } from '../components/Icon';
import { SHOPS_VE, VE_OILS, VISCOSITIES } from '../data/mock';
import { fmtFecha, fmtKm, parseFecha } from '../utils/format';
import { useVehicles } from '../store/useVehicles';
import { useOilStatus } from '../hooks/useOilStatus';

import { RootScreenProps } from '../navigation/types';

const INTERVALS = [3000, 5000, 7500, 10000];
/** El otro eje del ciclo: "5.000 km o 6 meses, lo que ocurra primero". */
const MESES = [3, 6, 9, 12];

export function AddOilScreen({ navigation, route }: RootScreenProps<'AddOil'>) {
  const insets = useSafeAreaInsets();
  const c = useAppColors();
  const sh = useShadows();
  const { vehicleId, draft } = route.params ?? {};
  const vehicles = useVehicles((s) => s.vehicles);
  const addVehicle = useVehicles((s) => s.addVehicle);
  const registrarCambio = useVehicles((s) => s.registrarCambio);

  const vehicle = vehicleId
    ? vehicles.find((v) => v.id === vehicleId)
    : undefined;
  const { data: estado } = useOilStatus(vehicleId ?? null);
  // El odómetro del vehículo ya no es un campo suyo: se toma la última lectura
  // conocida, que es lo que el usuario va a ver hoy en el tablero.
  const baseKm = draft?.km ?? estado?.odometer?.km ?? 0;

  const [oilName, setOilName] = useState('Pennzoil Platinum');
  const [viscosity, setViscosity] = useState('5W-30');
  const [oilType, setOilType] = useState('Sintético');
  const [changeKm, setChangeKm] = useState(String(baseKm));
  const [intervalIdx, setIntervalIdx] = useState(1);
  // Los dos ejes los elige el usuario. Se precargan con lo que ÉL mismo usó
  // en el ciclo anterior de este vehículo: no es una sugerencia inventada,
  // es su propio número.
  const [mesesIdx, setMesesIdx] = useState(() => {
    const previo = estado?.cycle?.intervalMonths;
    const i = previo ? MESES.indexOf(previo) : -1;
    return i === -1 ? 1 : i;
  });
  const [date, setDate] = useState(fmtFecha(new Date().toISOString()));
  const [errorFecha, setErrorFecha] = useState<string | null>(null);
  const [cost, setCost] = useState('32.00');
  const [shop, setShop] = useState(SHOPS_VE[0]);

  const interval = INTERVALS[intervalIdx];
  const meses = MESES[mesesIdx];
  const nextKm = useMemo(() => (parseInt(changeKm, 10) || 0) + interval, [changeKm, interval]);

  const oilOptions = VE_OILS.map((o) => `${o.brand} ${o.tag}`);
  const subtitle = draft
    ? `${draft.brand} ${draft.model} · ${draft.plate}`
    : vehicle
      ? `${vehicle.brand} ${vehicle.model} · ${vehicle.plate}`
      : '';

  const save = () => {
    const changedAt = parseFecha(date);
    if (!changedAt) {
      setErrorFecha('Escríbela como "08 feb 2026".');
      return;
    }

    const km = parseInt(changeKm, 10) || 0;
    const [brand, ...tagParts] = oilName.split(' ');
    const costUsd = parseFloat(cost.replace(',', '.')) || 0;

    const cambio = {
      changedAt,
      km,
      intervalKm: interval,
      intervalMonths: meses,
      oilBrand: brand,
      oilTag: tagParts.join(' '),
      oilViscosity: viscosity,
      oilSynthetic: oilType === 'Sintético',
      shop,
      costUsd,
    };

    if (draft) {
      // Paso 3 del flujo agregar vehículo: crea el vehículo y su primer ciclo.
      // Las dos escrituras van a la cola en orden, así que el cambio llega
      // después del vehículo aunque no haya señal en este momento.
      const { km: _kmInicial, ...ficha } = draft;
      const id = addVehicle(ficha);
      registrarCambio(id, cambio);
      navigation.popToTop();
    } else if (vehicle) {
      registrarCambio(vehicle.id, cambio);
      navigation.goBack();
    }
  };

  const sliderPct = (intervalIdx / (INTERVALS.length - 1)) * 100;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Box f={1} bg="$bg3">
        {/* Esta pantalla es el paso 3 del alta, pero también se abre sola para
            registrar un cambio en un vehículo que ya existe: ahí no hay pasos
            que contar y el header vuelve a ser un título. */}
        {draft ? (
          <StepHeader step={3} total={3} onBack={() => navigation.goBack()} />
        ) : (
          <Row jc="space-between" px="$xl" pt={insets.top + 12}>
            <IconBtn icon={<Icon name="chevL" color={c.ink} size={20} />} onPress={() => navigation.goBack()} />
            <Txt font="mono" fos={11} tone="muted" ls={1}>NUEVO CAMBIO</Txt>
            <Box w={36} />
          </Row>
        )}

        <Scroll bg="$bg3" keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 140 }}>
          <Col px="$2xl" pb="$sm" pt="$xl">
            <Txt font="display" fos={26} lh={30} ls={-0.5}>
              Registrar cambio de aceite
            </Txt>
            {subtitle ? (
              <Txt fos={14} tone="muted" mt={6}>{subtitle}</Txt>
            ) : null}
          </Col>

          <Col gap="$md" px="$lg" pt="$lg">
            {/* Card 1 — Aceite */}
            <Card gap={14}>
              <Field label="Tipo de aceite">
                <Select value={oilName} options={oilOptions} onChange={setOilName} />
              </Field>
              <Row gap="$md" ai="flex-start">
                <Box f={1}>
                  <Field label="Viscosidad">
                    <Select value={viscosity} options={VISCOSITIES} onChange={setViscosity} />
                  </Field>
                </Box>
                <Box f={1}>
                  <Field label="Tipo">
                    <Select value={oilType} options={['Sintético', 'Semi-sintético', 'Mineral']} onChange={setOilType} />
                  </Field>
                </Box>
              </Row>

              {/* chips de viscosidad */}
              <Row flexWrap="wrap" gap={6}>
                {VISCOSITIES.map((v) => {
                  const isActive = v === viscosity;
                  return (
                    <Touchable
                      key={v}
                      onPress={() => setViscosity(v)}
                      fade
                      transition="quick"
                      h={30}
                      ai="center"
                      jc="center"
                      br="$pill"
                      px="$md"
                      bg={isActive ? '$solid' : '$surface'}
                      bw={isActive ? 0 : 1}
                      bc="$line"
                    >
                      <Txt font="mono" fos={12} tone={isActive ? 'onSolid' : 'muted'}>
                        {v}
                      </Txt>
                    </Touchable>
                  );
                })}
              </Row>
            </Card>

            {/* Card 2 — Kilometraje */}
            <Card gap={14}>
              <Row mb={-4} gap="$sm">
                <Box h={14} w={4} br={2} bg="$accent" />
                <Txt font="bold" fos={11} tone="muted" ls={1.2} caps>
                  Kilometraje
                </Txt>
              </Row>
              <Field label="Kilometraje del cambio" suffix="km">
                <Input
                  value={changeKm}
                  onChangeText={setChangeKm}
                  mono
                  keyboardType="number-pad"
                  right={<Txt font="monoMed" fos={12} tone="muted">km</Txt>}
                />
              </Field>
              <Field label="Próximo cambio a" suffix="km">
                <Input
                  value={String(nextKm)}
                  editable={false}
                  mono
                  right={<Txt font="monoMed" fos={12} tone="muted">km</Txt>}
                />
              </Field>

              {/* slider de intervalo */}
              <Col>
                <Row mb="$sm" jc="space-between">
                  <Txt font="semi" fos={12} tone="muted">Intervalo</Txt>
                  <Txt font="mono" fos={13}>{fmtKm(interval)} km</Txt>
                </Row>
                <Box h={22} jc="center">
                  <Box h={6} br={3} bg="$bg2">
                    <Box h="100%" br={3} bg="$accent" width={`${sliderPct}%`} transition="quick" />
                  </Box>
                  <Box
                    pos="absolute"
                    ml={-11}
                    h={22}
                    w={22}
                    br="$pill"
                    bw={3}
                    bc="$accent"
                    bg="$surface"
                    left={`${sliderPct}%`}
                    transition="quick"
                    style={sh.card}
                  />
                </Box>
                <Row mt={6} jc="space-between">
                  {INTERVALS.map((v, i) => (
                    <Touchable key={v} onPress={() => setIntervalIdx(i)} hitSlop={10} fade>
                      <Txt font="monoMed" fos={10} tone={i === intervalIdx ? 'accent' : 'muted2'}>
                        {fmtKm(v)}
                      </Txt>
                    </Touchable>
                  ))}
                </Row>
              </Col>

              {/* El segundo eje. Vale el que se cumpla primero: al que maneja
                  poco se le vence por meses mucho antes que por kilómetros. */}
              <Col>
                <Row mb="$sm" jc="space-between">
                  <Txt font="semi" fos={12} tone="muted">
                    O cada
                  </Txt>
                  <Txt font="mono" fos={13}>{meses} meses</Txt>
                </Row>
                <Row gap="$sm">
                  {MESES.map((m, i) => (
                    <Touchable
                      key={m}
                      f={1}
                      onPress={() => setMesesIdx(i)}
                      fade
                      ai="center"
                      py={8}
                      br="$md"
                      bw={1}
                      bc={i === mesesIdx ? '$accent' : '$line'}
                      bg={i === mesesIdx ? '$accentSoft' : 'transparent'}
                    >
                      <Txt
                        font="monoMed"
                        fos={12}
                        tone={i === mesesIdx ? 'accent' : 'muted2'}
                      >
                        {m}m
                      </Txt>
                    </Touchable>
                  ))}
                </Row>
              </Col>
            </Card>

            {/* Card 3 — Detalles */}
            <Card gap={14}>
              <Row gap="$md" ai="flex-start">
                <Box f={1}>
                  <Field label="Fecha" error={errorFecha ?? ''}>
                    <Input
                      value={date}
                      onChangeText={(t) => {
                        setDate(t);
                        setErrorFecha(null);
                      }}
                      mono
                      invalid={!!errorFecha}
                    />
                  </Field>
                </Box>
                <Box f={1}>
                  <Field label="Costo">
                    <Input
                      value={cost}
                      onChangeText={setCost}
                      mono
                      keyboardType="decimal-pad"
                      prefix="$"
                      right={
                        <Box br={4} bg="$bg2" px={6} py={2}>
                          <Txt font="monoMed" fos={11} tone="muted">USD</Txt>
                        </Box>
                      }
                    />
                  </Field>
                </Box>
              </Row>
              <Field label="Lubricentro / Taller">
                <Select value={shop} options={SHOPS_VE} onChange={setShop} />
              </Field>
            </Card>
          </Col>
        </Scroll>

        <Box pos="absolute" b={0} l={0} r={0} bg="$bg" px="$xl" pt="$lg" pb={Math.max(insets.bottom, 24) + 12}>
          <Btn kind="primary" size="lg" icon={<Icon name="check" color="#fff" size={20} />} onPress={save}>
            Guardar cambio
          </Btn>
        </Box>
      </Box>
    </KeyboardAvoidingView>
  );
}
