// Un solo número: lo que dice el tablero ahora.
//
// Existe porque el odómetro es el dato que la app no puede adivinar bien: se
// estima entre cambios con el ritmo del vehículo, y esta pantalla es la puerta
// para corregir esa estimación el día que el usuario sí lo tenga a la vista.
// Por eso es un campo y un botón, y nada más: si cuesta más de diez segundos,
// no se usa.
import React, { useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Box, Col, Scroll, Txt } from '../ui';
import { Btn, Field, Input } from '../components/primitives';
import { Icon } from '../components/Icon';
import { fmtKm } from '../utils/format';
import { useOilStatus } from '../hooks/useOilStatus';
import { useVehicles } from '../store/useVehicles';
import { RootScreenProps } from '../navigation/types';

export function ReportOdometerScreen({
  navigation,
  route,
}: RootScreenProps<'ReportOdometer'>) {
  const insets = useSafeAreaInsets();
  const { vehicleId } = route.params;
  const { data } = useOilStatus(vehicleId);
  const reportOdometer = useVehicles((s) => s.reportOdometer);

  const [km, setKm] = useState('');
  const [error, setError] = useState<string | null>(null);

  const ultima = data?.odometer?.km ?? null;
  const estimado = data?.odometer?.source === 'estimated';

  const guardar = () => {
    const valor = parseInt(km, 10);
    if (!Number.isFinite(valor)) {
      setError('Escribe el kilometraje que marca el tablero.');
      return;
    }
    // Se valida acá lo mismo que valida el backend, para que el error se vea
    // antes de viajar. El backend igual lo rechaza si algo se escapa.
    if (ultima !== null && valor < ultima) {
      setError(`No puede ser menor a ${fmtKm(ultima)} km. El odómetro no baja.`);
      return;
    }

    // Se escribe local y entra a la cola: funciona sin señal, que es
    // justamente cuando el usuario está sentado en el auto mirando el tablero.
    reportOdometer(vehicleId, valor);
    navigation.goBack();
  };

  return (
    <Box f={1} bg="$bg3">
      <Scroll
        contentContainerStyle={{
          paddingTop: insets.top + 24,
          paddingHorizontal: 20,
          gap: 16,
        }}
      >
        <Txt font="display" fos={26} ls={-0.5}>
          Kilometraje
        </Txt>

        <Txt fos={13} tone="muted">
          {estimado && ultima !== null
            ? `Ahora lo estimamos en ${fmtKm(ultima)} km. Corrígelo con lo que marca el tablero.`
            : 'Escribe lo que marca el tablero.'}
        </Txt>

        <Field
          label="Kilometraje actual"
          suffix="km"
          error={error ?? ''}
          hint={ultima !== null ? `Última lectura: ${fmtKm(ultima)} km` : ''}
        >
          <Input
            value={km}
            onChangeText={(t) => {
              setKm(t);
              setError(null);
            }}
            placeholder={ultima !== null ? String(ultima) : '78460'}
            mono
            keyboardType="number-pad"
            autoFocus
            invalid={!!error}
            right={
              <Txt font="monoMed" fos={12} tone="muted">
                km
              </Txt>
            }
          />
        </Field>

        <Col mt="$sm">
          <Btn
            kind="primary"
            size="lg"
            icon={<Icon name="check" color="#fff" size={18} />}
            onPress={guardar}
          >
            Guardar lectura
          </Btn>
        </Col>
      </Scroll>
    </Box>
  );
}
