// Garaje — lista multi-vehículo con filter chips y progreso de aceite
import React, { useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Box, Col, Row, Scroll, Touchable, Txt, useAppColors } from '../ui';
import { FilterChip, FilterChips, IconBtn } from '../components/primitives';
import { Icon } from '../components/Icon';
import { VehicleCard } from '../components/VehicleCard';
import { useVehicles } from '../store/useVehicles';
import { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/** Se ramifica por el `code`, nunca por el texto del backend. */
function mensajeDeRechazo(code: string): string {
  if (code === 'PLATE_TAKEN') return 'ya tienes un vehículo con esa placa';
  if (code === 'VEHICLE_NOT_FOUND') return 'ese vehículo ya no existe';
  if (code === 'VEHICLE_LIMIT_REACHED') return 'llegaste al tope de vehículos de tu plan';
  return 'revisa los datos';
}
type Filter = 'all' | 'car' | 'moto';

export function VehiclesScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const c = useAppColors();
  const vehicles = useVehicles((s) => s.vehicles);
  const rechazos = useVehicles((s) => s.rechazos);
  const [filter, setFilter] = useState<Filter>('all');

  const cars = vehicles.filter((v) => v.kind === 'car').length;
  const motos = vehicles.filter((v) => v.kind === 'moto').length;
  const filtered = filter === 'all' ? vehicles : vehicles.filter((v) => v.kind === filter);

  const chips: FilterChip<Filter>[] = [
    { id: 'all', label: 'Todos', n: vehicles.length },
    { id: 'car', label: 'Carros', n: cars },
    { id: 'moto', label: 'Motos', n: motos },
  ];

  return (
    <Box f={1} bg="$bg3">
      {/* top bar */}
      <Row jc="space-between" px="$xl" pb={14} pt={insets.top + 12}>
        <Col>
          <Txt font="display" fos={32} ls={-0.5}>
            Garaje · {vehicles.length}
          </Txt>
        </Col>
        <IconBtn
          icon={<Icon name="plus" color="#fff" size={22} />}
          filled
          size={40}
          onPress={() => navigation.navigate('AddVehicleType')}
        />
      </Row>

      {/* Con el garaje vacío los tres chips marcan 0 y no hay nada que filtrar:
          son ruido justo encima del mensaje que explica por qué no hay lista. */}
      {vehicles.length > 0 ? (
        <Box mb="$lg" px="$xl">
          <FilterChips chips={chips} value={filter} onChange={setFilter} />
        </Box>
      ) : null}

      <Scroll
        bg="$bg3"
        contentContainerStyle={{ gap: 12, paddingHorizontal: 16, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Sin esto la lista vacía es una pantalla en blanco y parece que algo
            falló. Se separa el garaje vacío del filtro sin resultados: son dos
            situaciones distintas y no se arreglan con lo mismo. */}
        {filtered.length === 0 ? (
          <Col ai="center" py="$2xl">
            <Row gap={8} br="$pill" bw={1} bc="$line" bg="$surfaceDim" px={14} py={8}>
              <Icon name={filter === 'moto' ? 'moto' : 'car'} color={c.muted2} size={16} />
              <Txt font="semi" fos={13} tone="muted">
                {vehicles.length === 0
                  ? 'Aún no tienes vehículos registrados'
                  : filter === 'car'
                    ? 'Aún no tienes carros registrados'
                    : 'Aún no tienes motos registradas'}
              </Txt>
            </Row>
          </Col>
        ) : null}

        {filtered.map((v) => {
          const rechazo = rechazos[v.id];
          return (
            <Touchable key={v.id} fade sink transition="quick" onPress={() => navigation.navigate('VehicleDetail', { vehicleId: v.id })}>
              <VehicleCard
                vehiculo={v}
                aviso={rechazo ? `No se pudo guardar: ${mensajeDeRechazo(rechazo)}` : undefined}
              />
            </Touchable>
          );
        })}

        {/* agregar vehículo */}
        <Touchable
          onPress={() => navigation.navigate('AddVehicleType')}
          fade
          sink
          transition="quick"
          h={56}
          fd="row"
          ai="center"
          jc="center"
          gap={10}
          br="$lg"
          bw={1}
          bc="$accent"
          borderStyle="dashed"
          bg="$surfaceDim"
        >
          <Icon name="plus" color={c.accent} size={18} />
          <Txt font="semi" fos={14} tone="accent">Agregar vehículo</Txt>
        </Touchable>
      </Scroll>
    </Box>
  );
}
