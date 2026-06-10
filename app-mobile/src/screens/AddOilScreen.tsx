// Registrar cambio de aceite — también es el Paso 3/3 del flujo agregar vehículo
import React, { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts, palette, radius, T } from '../theme';
import { Btn, Card, Field, IconBtn, Input, Select } from '../components/primitives';
import { Icon } from '../components/Icon';
import { SHOPS_VE, VE_OILS, VISCOSITIES } from '../data/mock';
import { fmtKm } from '../utils/format';
import { useStore } from '../store/useStore';
import { RootScreenProps } from '../navigation/types';

const INTERVALS = [3000, 5000, 7500, 10000];

export function AddOilScreen({ navigation, route }: RootScreenProps<'AddOil'>) {
  const insets = useSafeAreaInsets();
  const { vehicleId, draft } = route.params ?? {};
  const vehicles = useStore((s) => s.vehicles);
  const addVehicle = useStore((s) => s.addVehicle);
  const addOilChange = useStore((s) => s.addOilChange);

  const vehicle = vehicleId ? vehicles.find((v) => v.id === vehicleId) : undefined;
  const baseKm = draft?.km ?? vehicle?.km ?? 0;

  const [oilName, setOilName] = useState('Pennzoil Platinum');
  const [viscosity, setViscosity] = useState('5W-30');
  const [oilType, setOilType] = useState('Sintético');
  const [changeKm, setChangeKm] = useState(String(baseKm));
  const [intervalIdx, setIntervalIdx] = useState(1);
  const [date, setDate] = useState('09 jun 2026');
  const [cost, setCost] = useState('32.00');
  const [shop, setShop] = useState(SHOPS_VE[0]);

  const interval = INTERVALS[intervalIdx];
  const nextKm = useMemo(() => (parseInt(changeKm, 10) || 0) + interval, [changeKm, interval]);

  const oilOptions = VE_OILS.map((o) => `${o.brand} ${o.tag}`);
  const subtitle = draft
    ? `${draft.brand} ${draft.model} · ${draft.plate}`
    : vehicle
      ? `${vehicle.brand} ${vehicle.model} · ${vehicle.plate}`
      : '';

  const save = () => {
    const km = parseInt(changeKm, 10) || 0;
    const [brand, ...tagParts] = oilName.split(' ');
    const oil = { brand, tag: tagParts.join(' '), viscosity };
    const costUsd = parseFloat(cost.replace(',', '.')) || 0;

    if (draft) {
      // Paso 3 del flujo agregar vehículo: crea el vehículo + primer registro
      const id = addVehicle({
        ...draft,
        km: Math.max(draft.km, km),
        oil: { ...oil, synthetic: oilType === 'Sintético' },
        lastChange: km,
        nextChange: km + interval,
        daysSince: 0,
      });
      addOilChange({ vehicleId: id, date, km, oil, shop, costUsd });
      navigation.popToTop();
    } else if (vehicle) {
      addOilChange({ vehicleId: vehicle.id, date, km, oil, shop, costUsd });
      navigation.goBack();
    }
  };

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
          <Text style={{ fontFamily: fonts.mono, fontSize: 11, color: T.muted, letterSpacing: 1 }}>
            {draft ? 'PASO 3 / 3' : 'NUEVO CAMBIO'}
          </Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 140 }}>
          <View style={{ paddingHorizontal: 24, paddingTop: 20, paddingBottom: 8 }}>
            <Text style={{ fontFamily: fonts.display, fontSize: 26, color: T.ink, letterSpacing: -0.5, lineHeight: 30 }}>
              Registrar cambio de aceite
            </Text>
            {subtitle ? (
              <Text style={{ marginTop: 6, color: T.muted, fontFamily: fonts.sans, fontSize: 14 }}>{subtitle}</Text>
            ) : null}
          </View>

          <View style={{ paddingHorizontal: 16, paddingTop: 16, gap: 12 }}>
            {/* Card 1 — Aceite */}
            <Card style={{ gap: 14 }}>
              <Field label="Tipo de aceite">
                <Select value={oilName} options={oilOptions} onChange={setOilName} />
              </Field>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Field label="Viscosidad">
                    <Select value={viscosity} options={VISCOSITIES} onChange={setViscosity} />
                  </Field>
                </View>
                <View style={{ flex: 1 }}>
                  <Field label="Tipo">
                    <Select value={oilType} options={['Sintético', 'Semi-sintético', 'Mineral']} onChange={setOilType} />
                  </Field>
                </View>
              </View>

              {/* chips de viscosidad */}
              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                {VISCOSITIES.map((v) => {
                  const isActive = v === viscosity;
                  return (
                    <Pressable
                      key={v}
                      onPress={() => setViscosity(v)}
                      style={{
                        height: 30,
                        paddingHorizontal: 12,
                        borderRadius: radius.pill,
                        backgroundColor: isActive ? palette.primary : '#fff',
                        borderWidth: isActive ? 0 : 1,
                        borderColor: T.line,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text style={{ fontFamily: fonts.mono, fontSize: 12, color: isActive ? '#fff' : T.muted }}>{v}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </Card>

            {/* Card 2 — Kilometraje */}
            <Card style={{ gap: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: -4 }}>
                <View style={{ width: 4, height: 14, borderRadius: 2, backgroundColor: palette.accent }} />
                <Text style={{ fontFamily: fonts.sansBold, fontSize: 11, color: T.muted, letterSpacing: 1.2, textTransform: 'uppercase' }}>
                  Kilometraje
                </Text>
              </View>
              <Field label="Kilometraje del cambio" suffix="km">
                <Input
                  value={changeKm}
                  onChangeText={setChangeKm}
                  mono
                  keyboardType="number-pad"
                  right={<Text style={{ fontFamily: fonts.monoMed, fontSize: 12, color: T.muted }}>km</Text>}
                />
              </Field>
              <Field label="Próximo cambio a" suffix="km">
                <Input
                  value={String(nextKm)}
                  editable={false}
                  mono
                  right={<Text style={{ fontFamily: fonts.monoMed, fontSize: 12, color: T.muted }}>km</Text>}
                />
              </Field>

              {/* slider de intervalo */}
              <View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text style={{ fontFamily: fonts.sansSemi, fontSize: 12, color: T.muted }}>Intervalo</Text>
                  <Text style={{ fontFamily: fonts.mono, fontSize: 13, color: T.ink }}>{fmtKm(interval)} km</Text>
                </View>
                <View style={{ position: 'relative', height: 22, justifyContent: 'center' }}>
                  <View style={{ height: 6, backgroundColor: T.bg2, borderRadius: 3 }}>
                    <View
                      style={{
                        width: `${(intervalIdx / (INTERVALS.length - 1)) * 100}%`,
                        height: '100%',
                        backgroundColor: palette.accent,
                        borderRadius: 3,
                      }}
                    />
                  </View>
                  <View
                    style={{
                      position: 'absolute',
                      left: `${(intervalIdx / (INTERVALS.length - 1)) * 100}%`,
                      marginLeft: -11,
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      backgroundColor: '#fff',
                      borderWidth: 3,
                      borderColor: palette.accent,
                      shadowColor: '#000',
                      shadowOpacity: 0.12,
                      shadowRadius: 8,
                      shadowOffset: { width: 0, height: 2 },
                      elevation: 3,
                    }}
                  />
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
                  {INTERVALS.map((v, i) => (
                    <Pressable key={v} onPress={() => setIntervalIdx(i)} hitSlop={10}>
                      <Text
                        style={{
                          fontFamily: fonts.monoMed,
                          fontSize: 10,
                          color: i === intervalIdx ? palette.accent : T.muted2,
                        }}
                      >
                        {fmtKm(v)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </Card>

            {/* Card 3 — Detalles */}
            <Card style={{ gap: 14 }}>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Field label="Fecha">
                    <Input value={date} onChangeText={setDate} mono />
                  </Field>
                </View>
                <View style={{ flex: 1 }}>
                  <Field label="Costo">
                    <Input
                      value={cost}
                      onChangeText={setCost}
                      mono
                      keyboardType="decimal-pad"
                      prefix="$"
                      right={
                        <View style={{ paddingHorizontal: 6, paddingVertical: 2, backgroundColor: T.bg2, borderRadius: 4 }}>
                          <Text style={{ fontFamily: fonts.monoMed, fontSize: 11, color: T.muted }}>USD</Text>
                        </View>
                      }
                    />
                  </Field>
                </View>
              </View>
              <Field label="Lubricentro / Taller">
                <Select value={shop} options={SHOPS_VE} onChange={setShop} />
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
          <Btn kind="primary" size="lg" icon={<Icon name="check" color="#fff" size={20} />} onPress={save}>
            Guardar cambio
          </Btn>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
