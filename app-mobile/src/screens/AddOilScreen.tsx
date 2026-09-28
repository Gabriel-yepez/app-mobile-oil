// Registrar cambio de aceite — también es el Paso 3/3 del flujo agregar vehículo
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Box, Col, Row, Scroll, Touchable, Txt, useAppColors, useShadows } from '../ui';
import { Btn, Card, Field, IconBtn, Input, Select } from '../components/primitives';
import { StepHeader } from '../components/StepHeader';
import { Icon } from '../components/Icon';
import { VISCOSITIES } from '../data/mock';
import { fmtKm } from '../utils/format';
import { DateField } from '../components/DateField';
import { useShops, useTalleres } from '../store/useShops';
import { nombreValido as tallerValido, sugerirParecida } from '../data/talleres/nombre';
import { useVehicles } from '../store/useVehicles';
import { useOilStatus } from '../hooks/useOilStatus';
import { quedaCupoCambio, useSuscripcion } from '../store/suscripcion';

import { RootScreenProps } from '../navigation/types';

const INTERVALS = [3000, 5000, 7500, 10000];
/** El otro eje del ciclo: "5.000 km o 6 meses, lo que ocurra primero". */
const MESES = [3, 6, 9, 12];

/** El tipo es texto libre, pero el backend guarda además si es sintético.
 *  "Semi-sintético" y "semi synthetic" no cuentan: no son sintético pleno. */
const esSintetico = (tipo: string) => {
  const t = tipo.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return /sint|synth/.test(t) && !/semi/.test(t);
};

export function AddOilScreen({ navigation, route }: RootScreenProps<'AddOil'>) {
  const insets = useSafeAreaInsets();
  const c = useAppColors();
  const sh = useShadows();
  const { vehicleId, draft } = route.params ?? {};
  const vehicles = useVehicles((s) => s.vehicles);
  const addVehicle = useVehicles((s) => s.addVehicle);
  const registrarCambio = useVehicles((s) => s.registrarCambio);
  const suscripcion = useSuscripcion((s) => s.suscripcion);

  const vehicle = vehicleId
    ? vehicles.find((v) => v.id === vehicleId)
    : undefined;
  const { data: estado } = useOilStatus(vehicleId ?? null);
  // El odómetro del vehículo ya no es un campo suyo: se toma la última lectura
  // conocida, que es lo que el usuario va a ver hoy en el tablero.
  const baseKm = draft?.km ?? estado?.odometer?.km ?? 0;

  // Texto libre: cada quien usa lo que consigue y lo llama como lo conoce.
  const [oilName, setOilName] = useState('');
  const [viscosity, setViscosity] = useState('');
  const [oilType, setOilType] = useState('');
  const [errorAceite, setErrorAceite] = useState<string | null>(null);
  const [errorViscosidad, setErrorViscosidad] = useState<string | null>(null);
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
  // Medianoche UTC del día del teléfono: es lo que guarda y muestra el backend.
  const [date, setDate] = useState(() => {
    const d = new Date();
    return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())).toISOString();
  });
  const [cost, setCost] = useState('32.00');
  // Opcional: no todo el mundo recuerda o quiere decir dónde lo hizo.
  const [shop, setShop] = useState('');
  const talleres = useTalleres();
  const agregarTaller = useShops((s) => s.agregar);

  // Igual que pedirMarcaNueva en el paso 2: valida, y si se parece a uno que
  // ya existe pregunta antes de sumar un casi-duplicado al catálogo de todos.
  const pedirTallerNuevo = (texto: string) => {
    if (!tallerValido(texto)) {
      Alert.alert(
        'Ese nombre no sirve',
        'Usa letras, números, espacios y signos simples (. , - & # ( )). Máximo 60 caracteres.',
      );
      return;
    }

    const parecido = sugerirParecida(texto, talleres);
    if (parecido) {
      Alert.alert(`¿Quisiste decir ${parecido}?`, `Escribiste «${texto}».`, [
        { text: `Usar ${parecido}`, onPress: () => setShop(parecido) },
        {
          text: `Crear «${texto}»`,
          style: 'destructive',
          onPress: () => {
            agregarTaller(texto);
            setShop(texto);
          },
        },
      ]);
      return;
    }

    agregarTaller(texto);
    setShop(texto);
  };

  // En un vehículo que ya existe, lo más probable es que repita el aceite del
  // cambio anterior. El estado llega después del primer render, así que se
  // precarga cuando aparece y solo si el usuario no empezó a escribir.
  const aceitePrevio = estado?.oil;
  useEffect(() => {
    if (!aceitePrevio) return;
    setOilName((v) => v || `${aceitePrevio.brand} ${aceitePrevio.tag}`.trim());
    setViscosity((v) => v || aceitePrevio.viscosity);
    setOilType((v) => v || (aceitePrevio.type ?? ''));
  }, [aceitePrevio]);

  const interval = INTERVALS[intervalIdx];

  // La pista del intervalo se arrastra o se toca: el valor salta al paso más
  // cercano a la posición del dedo. El arrastre solo se activa en horizontal,
  // así un dedo que baja por la pantalla sigue haciendo scroll.
  const [anchoPista, setAnchoPista] = useState(0);
  const gestoPista = useMemo(() => {
    const irA = (x: number) => {
      if (anchoPista <= 0) return;
      const pct = Math.min(1, Math.max(0, x / anchoPista));
      setIntervalIdx(Math.round(pct * (INTERVALS.length - 1)));
    };
    const arrastre = Gesture.Pan()
      .runOnJS(true)
      .activeOffsetX([-6, 6])
      .failOffsetY([-12, 12])
      .onStart((e) => irA(e.x))
      .onUpdate((e) => irA(e.x));
    const toque = Gesture.Tap()
      .runOnJS(true)
      .onEnd((e) => irA(e.x));
    return Gesture.Race(arrastre, toque);
  }, [anchoPista]);
  const meses = MESES[mesesIdx];
  const nextKm = useMemo(() => (parseInt(changeKm, 10) || 0) + interval, [changeKm, interval]);

  const subtitle = draft
    ? `${draft.brand} ${draft.model} · ${draft.plate}`
    : vehicle
      ? `${vehicle.brand} ${vehicle.model} · ${vehicle.plate}`
      : '';

  const save = () => {
    const nombre = oilName.trim().replace(/\s+/g, ' ');
    const visc = viscosity.trim();
    const tipo = oilType.trim();
    const changedAt = date;
    if (!nombre) setErrorAceite('Escribe el aceite que usa.');
    if (!visc) setErrorViscosidad('Escribe la viscosidad.');
    if (!nombre || !visc) return;

    // Antes de encolar: sin esto, el cambio se vería guardado y el servidor
    // lo rechazaría al sincronizar. Solo se conoce el uso del mes en curso;
    // uno de otro mes lo decide el servidor.
    if (!quedaCupoCambio(suscripcion, changedAt)) {
      Alert.alert(
        'Llegaste al tope del mes',
        `Tu plan ${suscripcion?.plan.name} permite ${suscripcion?.plan.maxChangesPerMonth} cambios de aceite por mes. Pásate a Pro para registrar más.`,
        [
          { text: 'Ahora no', style: 'cancel' },
          { text: 'Ver planes', onPress: () => navigation.navigate('Subscription') },
        ],
      );
      return;
    }

    const km = parseInt(changeKm, 10) || 0;
    // El backend lo guarda en dos columnas; se parte en el primer espacio y
    // el resto puede quedar vacío ("Castrol").
    const [brand, ...tagParts] = nombre.split(' ');
    const costUsd = parseFloat(cost.replace(',', '.')) || 0;

    const cambio = {
      changedAt,
      km,
      intervalKm: interval,
      intervalMonths: meses,
      oilBrand: brand.slice(0, 40),
      oilTag: tagParts.join(' ').slice(0, 40),
      oilViscosity: visc,
      oilSynthetic: esSintetico(tipo),
      oilType: tipo || null,
      shop: shop || null,
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
              {draft ? 'Registre el aceite que usa en su vehículo' : 'Registrar cambio de aceite'}
            </Txt>
            {subtitle ? (
              <Txt fos={14} tone="muted" mt={6}>{subtitle}</Txt>
            ) : null}
          </Col>

          <Col gap="$md" px="$lg" pt="$lg">
            {/* Card 1 — Aceite */}
            <Card gap={14}>
              <Field label="Nombre del aceite" error={errorAceite ?? ''}>
                <Input
                  value={oilName}
                  onChangeText={(t) => {
                    setOilName(t);
                    setErrorAceite(null);
                  }}
                  placeholder="Pennzoil Platinum"
                  autoCapitalize="words"
                  maxLength={60}
                  invalid={!!errorAceite}
                />
              </Field>
              <Row gap="$md" ai="flex-start">
                <Box f={1}>
                  <Field label="Viscosidad" error={errorViscosidad ?? ''}>
                    <Input
                      value={viscosity}
                      onChangeText={(t) => {
                        setViscosity(t.toUpperCase());
                        setErrorViscosidad(null);
                      }}
                      placeholder="5W-30"
                      mono
                      autoCapitalize="characters"
                      autoCorrect={false}
                      maxLength={20}
                      invalid={!!errorViscosidad}
                    />
                  </Field>
                </Box>
                <Box f={1}>
                  <Field label="Tipo" suffix="opcional">
                    <Input
                      value={oilType}
                      onChangeText={setOilType}
                      placeholder="Sintético"
                      autoCapitalize="sentences"
                      maxLength={30}
                    />
                  </Field>
                </Box>
              </Row>

              {/* Atajos de viscosidad: llenan el campo, no lo limitan. */}
              <Row flexWrap="wrap" gap={6}>
                {VISCOSITIES.map((v) => {
                  const isActive = v === viscosity;
                  return (
                    <Touchable
                      key={v}
                      onPress={() => {
                        setViscosity(v);
                        setErrorViscosidad(null);
                      }}
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
                {/* 44 de alto para el dedo; el margen negativo lo deja ocupando
                    los mismos 22 de antes en el diseño. */}
                <GestureDetector gesture={gestoPista}>
                  <Box
                    h={44}
                    my={-11}
                    jc="center"
                    onLayout={(e) => setAnchoPista(e.nativeEvent.layout.width)}
                  >
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
                </GestureDetector>
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
                  <Field label="Fecha">
                    <DateField value={date} onChange={setDate} titulo="Fecha del cambio" noFuturo />
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
              <Field label="Lubricentro / Taller" suffix="opcional">
                <Select
                  value={shop}
                  placeholder="Selecciona el taller"
                  options={talleres}
                  onChange={setShop}
                  searchable
                  onAddNew={pedirTallerNuevo}
                  nuevo="un taller nuevo"
                />
              </Field>
            </Card>
          </Col>
        </Scroll>

        <Box pos="absolute" b={0} l={0} r={0} bg="$bg" px="$xl" pt="$lg" pb={Math.max(insets.bottom, 24) + 12}>
          <Btn kind="primary" size="lg" icon={<Icon name="check" color="#fff" size={20} />} onPress={save}>
            {draft ? 'Guardar vehículo' : 'Guardar cambio'}
          </Btn>
        </Box>
      </Box>
    </KeyboardAvoidingView>
  );
}
