// Registrar cambio de aceite — también es el Paso 3/3 del flujo agregar vehículo
import React, { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import clsx from 'clsx';
import { Pressable, ScrollView, Text, View } from '../tw';
import { T } from '../theme';
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
      <View className="flex-1 bg-bg3">
        {/* header */}
        <View
          className="flex-row items-center justify-between px-5"
          style={{ paddingTop: insets.top + 12 }}
        >
          <IconBtn icon={<Icon name="chevL" color={T.ink} size={20} />} onPress={() => navigation.goBack()} />
          <Text className="font-mono text-[11px] text-muted tracking-[1px]">
            {draft ? 'PASO 3 / 3' : 'NUEVO CAMBIO'}
          </Text>
          <View className="w-9" />
        </View>

        <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="pb-[140px]">
          <View className="px-6 pb-2 pt-5">
            <Text className="font-display text-[26px] leading-[30px] text-ink tracking-[-0.5px]">
              Registrar cambio de aceite
            </Text>
            {subtitle ? (
              <Text className="mt-1.5 font-sans text-[14px] text-muted">{subtitle}</Text>
            ) : null}
          </View>

          <View className="gap-3 px-4 pt-4">
            {/* Card 1 — Aceite */}
            <Card className="gap-3.5">
              <Field label="Tipo de aceite">
                <Select value={oilName} options={oilOptions} onChange={setOilName} />
              </Field>
              <View className="flex-row gap-3">
                <View className="flex-1">
                  <Field label="Viscosidad">
                    <Select value={viscosity} options={VISCOSITIES} onChange={setViscosity} />
                  </Field>
                </View>
                <View className="flex-1">
                  <Field label="Tipo">
                    <Select value={oilType} options={['Sintético', 'Semi-sintético', 'Mineral']} onChange={setOilType} />
                  </Field>
                </View>
              </View>

              {/* chips de viscosidad */}
              <View className="flex-row flex-wrap gap-1.5">
                {VISCOSITIES.map((v) => {
                  const isActive = v === viscosity;
                  return (
                    <Pressable
                      key={v}
                      onPress={() => setViscosity(v)}
                      className={clsx(
                        'h-[30px] items-center justify-center rounded-full px-3',
                        isActive ? 'bg-primary' : 'border border-line bg-white'
                      )}
                    >
                      <Text className={clsx('font-mono text-[12px]', isActive ? 'text-white' : 'text-muted')}>
                        {v}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </Card>

            {/* Card 2 — Kilometraje */}
            <Card className="gap-3.5">
              <View className="-mb-1 flex-row items-center gap-2">
                <View className="h-3.5 w-1 rounded-[2px] bg-accent" />
                <Text className="font-sans-bold text-[11px] text-muted tracking-[1.2px] uppercase">
                  Kilometraje
                </Text>
              </View>
              <Field label="Kilometraje del cambio" suffix="km">
                <Input
                  value={changeKm}
                  onChangeText={setChangeKm}
                  mono
                  keyboardType="number-pad"
                  right={<Text className="font-mono-med text-[12px] text-muted">km</Text>}
                />
              </Field>
              <Field label="Próximo cambio a" suffix="km">
                <Input
                  value={String(nextKm)}
                  editable={false}
                  mono
                  right={<Text className="font-mono-med text-[12px] text-muted">km</Text>}
                />
              </Field>

              {/* slider de intervalo */}
              <View>
                <View className="mb-2 flex-row justify-between">
                  <Text className="font-sans-semi text-[12px] text-muted">Intervalo</Text>
                  <Text className="font-mono text-[13px] text-ink">{fmtKm(interval)} km</Text>
                </View>
                <View className="relative h-[22px] justify-center">
                  <View className="h-1.5 rounded-[3px] bg-bg2">
                    <View
                      className="h-full rounded-[3px] bg-accent"
                      style={{ width: `${(intervalIdx / (INTERVALS.length - 1)) * 100}%` }}
                    />
                  </View>
                  <View
                    className="absolute -ml-[11px] h-[22px] w-[22px] rounded-full border-[3px] border-accent bg-white shadow-[0px_2px_8px_rgba(0,0,0,0.12)]"
                    style={{ left: `${(intervalIdx / (INTERVALS.length - 1)) * 100}%` }}
                  />
                </View>
                <View className="mt-1.5 flex-row justify-between">
                  {INTERVALS.map((v, i) => (
                    <Pressable key={v} onPress={() => setIntervalIdx(i)} hitSlop={10}>
                      <Text
                        className={clsx(
                          'font-mono-med text-[10px]',
                          i === intervalIdx ? 'text-accent' : 'text-muted2'
                        )}
                      >
                        {fmtKm(v)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </Card>

            {/* Card 3 — Detalles */}
            <Card className="gap-3.5">
              <View className="flex-row gap-3">
                <View className="flex-1">
                  <Field label="Fecha">
                    <Input value={date} onChangeText={setDate} mono />
                  </Field>
                </View>
                <View className="flex-1">
                  <Field label="Costo">
                    <Input
                      value={cost}
                      onChangeText={setCost}
                      mono
                      keyboardType="decimal-pad"
                      prefix="$"
                      right={
                        <View className="rounded-[4px] bg-bg2 px-1.5 py-0.5">
                          <Text className="font-mono-med text-[11px] text-muted">USD</Text>
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
          className="absolute bottom-0 left-0 right-0 bg-white px-5 pt-4"
          style={{ paddingBottom: Math.max(insets.bottom, 24) + 12 }}
        >
          <Btn kind="primary" size="lg" icon={<Icon name="check" color="#fff" size={20} />} onPress={save}>
            Guardar cambio
          </Btn>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
