// Editar vehículo — el destino del lápiz del detalle.
//
// Edita la FICHA (marca, modelo, año, placa, color, kilometraje), no el aceite:
// el aceite y el historial se cambian registrando un cambio, que es un hecho
// con fecha, no un campo de formulario.
//
// Como en editar perfil, el formulario trabaja sobre una copia local y solo
// escribe al store al guardar: volver atrás no deja nada a medias.
import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Box, Col, Row, Screen, Scroll, Touchable, Txt, useAppColors } from '../ui';
import { Btn, Card, Field, IconBtn, Input, Select, SectionHead } from '../components/primitives';
import { Icon } from '../components/Icon';
import { useBrands, useMarcasDe } from '../store/useBrands';
import { nombreValido, sugerirParecida } from '../data/marcas/nombre';
import { useVehicles } from '../store/useVehicles';
import { useOilStatus } from '../hooks/useOilStatus';
import { ColorSelect } from '../components/ColorSelect';
import { RootScreenProps } from '../navigation/types';

const AHORA = new Date().getFullYear();

export function EditVehicleScreen({ navigation, route }: RootScreenProps<'EditVehicle'>) {
  const insets = useSafeAreaInsets();
  const c = useAppColors();
  const vehicle = useVehicles((s) =>
    s.vehicles.find((v) => v.id === route.params.vehicleId),
  );
  const updateVehicle = useVehicles((s) => s.updateVehicle);
  const removeVehicle = useVehicles((s) => s.removeVehicle);
  const reportOdometer = useVehicles((s) => s.reportOdometer);
  const { data: estado } = useOilStatus(route.params.vehicleId);

  // El vehículo puede haber desaparecido (lo borró esta misma pantalla y el
  // render corre antes de que la navegación saque la escena).
  const [form, setForm] = useState({
    brand: vehicle?.brand ?? '',
    model: vehicle?.model ?? '',
    year: String(vehicle?.year ?? ''),
    plate: vehicle?.plate ?? '',
    km: '',
    color: vehicle?.color ?? '#1F2937',
    // Se muestra en km/mes, que es como la gente sabe cuánto maneja.
    kmMes: String(Math.round((vehicle?.kmPerDay ?? 40) * 30)),
  });
  const [intento, setIntento] = useState(false);

  if (!vehicle) return null;

  const brands = useMarcasDe(vehicle.kind);
  const agregarMarca = useBrands((s) => s.agregar);

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
        { text: `Usar ${parecida}`, onPress: () => set('brand', parecida) },
        {
          text: `Crear «${texto}»`,
          style: 'destructive',
          onPress: () => {
            agregarMarca(vehicle.kind, texto);
            set('brand', texto);
          },
        },
      ]);
      return;
    }

    agregarMarca(vehicle.kind, texto);
    set('brand', texto);
  };
  const set = <K extends keyof typeof form>(k: K, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));


  const año = parseInt(form.year, 10);
  const km = parseInt(form.km, 10);
  const kmMesNum = parseInt(form.kmMes, 10);
  const ultimaLectura = estado?.odometer?.km ?? null;

  const errores = {
    model: form.model.trim() ? '' : 'Poné el modelo',
    year: !form.year.trim()
      ? 'Poné el año'
      : Number.isNaN(año) || año < 1950 || año > AHORA + 1
        ? `Un año entre 1950 y ${AHORA + 1}`
        : '',
    plate: form.plate.trim() ? '' : 'Poné la placa',
    // El odómetro es opcional acá: es una LECTURA, no un campo de la ficha.
    // Se deja en blanco si el usuario no lo tiene a mano —que es el caso
    // normal— y solo se valida si escribió algo.
    km: !form.km.trim()
      ? ''
      : Number.isNaN(km) || km < 0
        ? 'Un número de kilómetros'
        : ultimaLectura !== null && km < ultimaLectura
          ? `No puede ser menor a la última lectura (${ultimaLectura} km)`
          : '',
    kmMes:
      Number.isNaN(kmMesNum) || kmMesNum < 30 || kmMesNum > 15_000
        ? 'Entre 30 y 15.000 km al mes'
        : '',
  };
  const hayError = Object.values(errores).some(Boolean);
  const err = (k: keyof typeof errores) => (intento ? errores[k] : '');

  const guardar = () => {
    setIntento(true);
    if (hayError) return;
    updateVehicle(vehicle.id, {
      brand: form.brand || brands[0],
      model: form.model.trim(),
      year: año,
      plate: form.plate.trim().toUpperCase(),
      color: form.color,
      // Pisar el ritmo a mano devuelve kmPerDaySource a DECLARED en el
      // backend; el próximo ciclo medido lo recalibra solo.
      kmPerDay:
        Math.round((Math.min(15_000, Math.max(30, kmMesNum)) / 30) * 100) / 100,
    });

    // El odómetro va por su propio camino: es un hecho fechado, no un campo de
    // la ficha, y el backend lo guarda como lectura para anclar la proyección.
    if (form.km.trim() && !Number.isNaN(km)) {
      reportOdometer(vehicle.id, km);
    }

    navigation.goBack();
  };

  const borrar = () => {
    Alert.alert(
      `¿Eliminar ${vehicle.brand} ${vehicle.model}?`,
      'Se borra también todo su historial de cambios. No se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            removeVehicle(vehicle.id);
            // Dos atrás de una: esta pantalla y el detalle del vehículo que ya
            // no existe. Con dos goBack() encadenados, el detalle llega a
            // renderizarse en el medio sin su vehículo.
            navigation.pop(2);
          },
        },
      ]
    );
  };

  return (
    <Screen>
      <Row jc="space-between" ai="center" px="$lg" pb="$md" style={{ paddingTop: insets.top + 12 }}>
        <IconBtn
          icon={<Icon name="chevL" color={c.ink} size={20} />}
          onPress={() => navigation.goBack()}
        />
        <Txt font="display" fos={18}>
          Editar vehículo
        </Txt>
        <Box w={36} />
      </Row>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Scroll
          contentContainerStyle={{ paddingBottom: 32, gap: 18 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Col gap="$sm">
            <SectionHead>Ficha</SectionHead>
            <Box px="$lg">
              <Card gap={14}>
                <Field label="Marca">
                  <Select
                    value={form.brand}
                    placeholder="Selecciona la marca"
                    options={brands}
                    onChange={(v) => set('brand', v)}
                    searchable
                    onAddNew={pedirMarcaNueva}
                  />
                </Field>

                <Field label="Modelo" error={err('model')}>
                  <Input
                    value={form.model}
                    onChangeText={(v) => set('model', v)}
                    placeholder="Corolla XEI"
                    invalid={!!err('model')}
                  />
                </Field>

                <Row gap="$md" ai="flex-start">
                  <Box f={1}>
                    <Field label="Año" error={err('year')}>
                      <Input
                        value={form.year}
                        onChangeText={(v) => set('year', v)}
                        placeholder="2019"
                        mono
                        keyboardType="number-pad"
                        maxLength={4}
                        invalid={!!err('year')}
                      />
                    </Field>
                  </Box>
                  <Box f={1}>
                    <Field label="Color">
                      <ColorSelect
                        value={form.color}
                        onChange={(hex) => set('color', hex)}
                      />
                    </Field>
                  </Box>
                </Row>

                <Field label="Placa" suffix="formato VE" error={err('plate')}>
                  <Input
                    value={form.plate}
                    onChangeText={(v) => set('plate', v.toUpperCase())}
                    placeholder={vehicle.kind === 'car' ? 'AC123BD' : 'AAB12P'}
                    mono
                    autoCapitalize="characters"
                    invalid={!!err('plate')}
                  />
                </Field>

                {/* Cuánto maneja: la base con la que se proyecta el
                    odómetro entre cambio y cambio. */}
                <Field
                  label="¿Cuánto manejas normalmente?"
                  suffix="km al mes"
                  error={err('kmMes')}
                  hint="Con esto estimamos el odómetro entre cambios"
                >
                  <Input
                    value={form.kmMes}
                    onChangeText={(v) => set('kmMes', v)}
                    placeholder="1200"
                    mono
                    keyboardType="number-pad"
                    invalid={!!err('kmMes')}
                    right={<Txt font="monoMed" fos={12} tone="muted">km/mes</Txt>}
                  />
                </Field>

                {/* Opcional a propósito: es una LECTURA del tablero, no un
                    campo de la ficha. Si no lo tiene a mano, se deja vacío y
                    la estimación sigue como está. */}
                <Field
                  label="Kilometraje de hoy (opcional)"
                  suffix="km"
                  error={err('km')}
                  hint={
                    ultimaLectura !== null
                      ? `Última lectura: ${ultimaLectura} km`
                      : 'Solo si lo tienes a la vista'
                  }
                >
                  <Input
                    value={form.km}
                    onChangeText={(v) => set('km', v)}
                    placeholder="78460"
                    mono
                    keyboardType="number-pad"
                    invalid={!!err('km')}
                    right={<Txt font="monoMed" fos={12} tone="muted">km</Txt>}
                  />
                </Field>
              </Card>
            </Box>
          </Col>

          <Box px="$lg">
            <Btn size="lg" onPress={guardar}>
              Guardar cambios
            </Btn>
          </Box>

          <Col gap="$sm">
            <SectionHead>Zona de riesgo</SectionHead>
            <Box px="$lg">
              <Touchable
                onPress={borrar}
                transition="quick"
                h={48}
                fd="row"
                ai="center"
                jc="center"
                gap="$sm"
                br="$md"
                bw={1.5}
                bc="$danger"
                bg="transparent"
                pressStyle={{ bg: '$bg2' }}
              >
                <Icon name="trash" color={c.danger} size={18} />
                <Txt font="semi" fos={15} tone="danger">Eliminar vehículo</Txt>
              </Touchable>
              <Txt fos={12} tone="muted2" ta="center" mt="$sm">
                Se borra también su historial de cambios.
              </Txt>
            </Box>
          </Col>
        </Scroll>
      </KeyboardAvoidingView>
    </Screen>
  );
}
