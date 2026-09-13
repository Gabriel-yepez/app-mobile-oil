// Historial completo — resumen de inversión USD/Bs.S + lista de todos los cambios
import React, { useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Box, Col, Row, Scroll, Txt, useAppColors } from '../ui';
import { radius } from '../theme';
import { Card, FilterChip, FilterChips, IconBtn, VehicleThumb } from '../components/primitives';
import { Icon } from '../components/Icon';
import { fmtKm, fmtUsd } from '../utils/format';
import { BS_RATE, SPEND_BARS } from '../data/mock';
import { useStore } from '../store/useStore';

// El filtro tiene DOS niveles y no una sola fila larga de chips: con un chip
// por vehículo, una flota de seis ya no entra en pantalla. Primero se elige el
// tipo (Todos / Carros / Motos) y, si se eligió uno, aparece debajo la lista de
// vehículos de ESE tipo para afinar. Así la segunda fila nunca es más larga que
// los vehículos de una categoría.
type Kind = 'all' | 'car' | 'moto';

export function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const c = useAppColors();
  const changes = useStore((s) => s.changes);
  const vehicles = useStore((s) => s.vehicles);
  const [kind, setKind] = useState<Kind>('all');
  const [elegido, setElegido] = useState<string>('all');

  const vehicleOf = (id: string) => vehicles.find((v) => v.id === id);

  // Un cambio no tiene tipo propio: lo hereda del vehículo al que pertenece.
  const kindOf = (vehicleId: string) => vehicleOf(vehicleId)?.kind;

  const delTipo = kind === 'all' ? [] : vehicles.filter((v) => v.kind === kind);

  // El vehículo elegido puede haber dejado de valer: se borró, o se cambió el
  // tipo de arriba. En vez de dejar la lista vacía sin explicación, se cae a
  // "todos los de este tipo".
  const vid = delTipo.some((v) => v.id === elegido) ? elegido : 'all';

  const coincide = (vehicleId: string) => {
    if (kind === 'all') return true;
    if (vid !== 'all') return vehicleId === vid;
    return kindOf(vehicleId) === kind;
  };

  const cuenta = (predicado: (vehicleId: string) => boolean) =>
    changes.filter((ch) => predicado(ch.vehicleId)).length;

  const filtered = changes.filter((ch) => coincide(ch.vehicleId));

  const chipsTipo: FilterChip<Kind>[] = [
    { id: 'all', label: 'Todos', n: changes.length },
    { id: 'car', label: 'Carros', n: cuenta((id) => kindOf(id) === 'car') },
    { id: 'moto', label: 'Motos', n: cuenta((id) => kindOf(id) === 'moto') },
  ];

  const chipsVehiculo: FilterChip<string>[] = [
    { id: 'all', label: kind === 'moto' ? 'Todas' : 'Todos', n: cuenta((id) => kindOf(id) === kind) },
    ...delTipo.map((v) => ({
      id: v.id,
      label: `${v.brand} ${v.model}`,
      n: cuenta((id) => id === v.id),
    })),
  ];

  const elegirTipo = (k: Kind) => {
    setKind(k);
    // Cambiar de tipo limpia el vehículo: el de antes es de la otra categoría.
    setElegido('all');
  };

  // El total sigue al filtro: un "invertido" que incluye carros encima de una
  // lista de solo motos no se entiende.
  const totalUsd = filtered.reduce((sum, ch) => sum + ch.costUsd, 0);
  const maxBar = Math.max(...SPEND_BARS);

  return (
    <Box f={1} bg="$bg3">
      {/* top bar */}
      <Row jc="space-between" px="$xl" pb={14} pt={insets.top + 12}>
        <Row gap="$md">
          {navigation.canGoBack() ? (
            <IconBtn icon={<Icon name="chevL" color={c.ink} size={20} />} onPress={() => navigation.goBack()} />
          ) : null}
          <Col>
            <Txt fos={12} tone="muted" ls={1} caps>
              Historial
            </Txt>
            <Txt font="display" fos={26} ls={-0.5}>
              {filtered.length} {filtered.length === 1 ? 'cambio' : 'cambios'}
            </Txt>
          </Col>
        </Row>
      </Row>

      <Scroll bg="$bg3" contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        {/* inversión */}
        <Box px="$lg" pb={14}>
          <LinearGradient
            colors={[c.primary, c.primary2]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ borderRadius: radius.lg, padding: 16 }}
          >
            <Txt font="bold" fos={11} tone="onDarkMuted" ls={1.2} caps>
              Inversión 2026
            </Txt>
            <Row ai="baseline" gap="$sm" mt={6}>
              <Txt font="mono" fos={32} tone="onDark" ls={-1}>{fmtUsd(totalUsd)}</Txt>
              <Txt fos={12} tone="onDarkSoft">
                USD · ≈ Bs.S {fmtKm(totalUsd * BS_RATE)}
              </Txt>
            </Row>

            {/* mini bar chart */}
            <Row mt={14} h={50} ai="flex-end" gap={6}>
              {SPEND_BARS.map((h, i) => (
                <Box
                  key={i}
                  f={1}
                  br={3}
                  bg={i === SPEND_BARS.length - 1 ? '$accent2' : 'rgba(255,255,255,0.18)'}
                  height={`${(h / maxBar) * 100}%`}
                  transition="gauge"
                  enterStyle={{ height: 0 }}
                />
              ))}
            </Row>
            <Row mt={6} jc="space-between">
              {['ENE', 'ABR', 'JUL', 'OCT', 'DIC'].map((m) => (
                <Txt key={m} font="monoMed" fos={10} tone="onDarkMuted">
                  {m}
                </Txt>
              ))}
            </Row>
          </LinearGradient>
        </Box>

        {/* Filtros: debajo del hero y encima de la lista, que es lo que
            gobiernan. Arriba del hero quedaban lejos de su efecto. */}
        <Col gap="$sm" pb={14}>
          <FilterChips chips={chipsTipo} value={kind} onChange={elegirTipo} px={20} />

          {/* La segunda fila solo existe cuando hay un tipo elegido y más de un
              vehículo de ese tipo: con uno solo, afinar no filtra nada. */}
          {delTipo.length > 1 ? (
            <FilterChips
              chips={chipsVehiculo}
              value={vid}
              onChange={setElegido}
              scrollable
              px={20}
            />
          ) : null}
        </Col>

        {/* lista */}
        <Col gap={10} px="$lg">
          {/* Con filtro puesto la lista puede quedar vacía: sin esto se ve una
              pantalla en blanco y parece que algo se rompió. */}
          {filtered.length === 0 ? (
            <Txt fos={13} tone="muted2" ta="center" py="$2xl">
              Todavía no hay cambios registrados con este filtro.
            </Txt>
          ) : null}

          {filtered.map((h) => {
            const v = vehicleOf(h.vehicleId);
            return (
              <Card key={h.id} fd="row" ai="center" gap="$md">
                <VehicleThumb kind={v?.kind ?? 'car'} color={v?.color ?? '#1F2937'} size={42} />
                <Col f={1}>
                  <Txt font="bold" fos={14} ls={-0.1}>
                    {v ? `${v.brand} ${v.model}` : 'Vehículo'}
                  </Txt>
                  <Txt fos={12} tone="muted" mt={1}>
                    <Txt font="monoMed" fos={12} tone="muted">{h.date}</Txt> ·{' '}
                    <Txt font="monoMed" fos={12} tone="muted">{fmtKm(h.km)}</Txt> km
                  </Txt>
                  <Txt fos={12} tone="muted2" mt={1}>
                    {h.oil.brand} {h.oil.tag} {h.oil.viscosity}
                  </Txt>
                </Col>
                <Col ai="flex-end">
                  <Txt font="mono" fos={14}>{fmtUsd(h.costUsd)}</Txt>
                  <Txt fos={10} tone="muted2">USD</Txt>
                </Col>
              </Card>
            );
          })}
        </Col>
      </Scroll>
    </Box>
  );
}
