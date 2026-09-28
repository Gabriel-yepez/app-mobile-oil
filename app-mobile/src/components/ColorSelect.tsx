// Selector de color del vehículo: una muestra del tono y su nombre, y al
// tocarlo una hoja con todo el catálogo.
//
// Antes esto CICLABA: cada toque pasaba al siguiente color, así que llegar al
// décimo eran nueve toques y no había forma de ver qué colores existían.
//
// En la hoja, tocar un color NO lo elige todavía: lo prueba sobre la tarjeta
// del garaje, que se repinta en vivo. Se elige con "Usar este color"; cerrar
// la hoja deja el que estaba. Así se puede comparar sin miedo.
import React, { useState } from 'react';
import { ScrollView } from 'react-native';
import { Box, Row, Touchable, Txt, useAppColors } from '../ui';
import { Btn, HojaModal, VehicleThumb } from './primitives';
import { Icon } from './Icon';
import { VehicleCard, type VehiculoTarjeta } from './VehicleCard';
import { useColors } from '../store/useColors';
import type { ApiColor } from '../api/controllers/colors.controller';

type Props = {
  /** El hex guardado. Puede no estar en el catálogo. */
  value: string;
  onChange: (hex: string) => void;
  /** Los datos del vehículo para la vista previa. Sin ellos se muestra solo
   *  la miniatura. */
  vehiculo?: Omit<VehiculoTarjeta, 'color'>;
};

const esHex6 = (hex: string) => /^#[0-9a-f]{6}$/i.test(hex);

/** Para el check encima de la muestra: blanco sobre oscuros, tinta sobre
 *  claros. Sin esto el check desaparece sobre el blanco y el plata. */
function esClaro(hex: string) {
  if (!esHex6(hex)) return false;
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return 0.299 * r + 0.587 * g + 0.114 * b > 170;
}

/** La muestra circular. El borde importa: sin él, el blanco y el beige se
 *  pierden contra la tarjeta y parecen un hueco. */
function Muestra({ hex, size = 22 }: { hex: string; size?: number }) {
  return <Box h={size} w={size} br="$pill" bg={hex} bw={1} bc="$line" />;
}

const mismo = (a: string, b: string) => a.toUpperCase() === b.toUpperCase();

export function ColorSelect({ value, onChange, vehiculo }: Props) {
  const [open, setOpen] = useState(false);
  const [tono, setTono] = useState(value);
  const c = useAppColors();
  const colores = useColors((s) => s.colores);

  const nombreDe = (hex: string): ApiColor | null =>
    colores.find((x) => mismo(x.hex, hex)) ?? null;
  const elegido = nombreDe(value);
  const probando = nombreDe(tono);

  const abrir = () => {
    setTono(value);
    setOpen(true);
  };

  const confirmar = () => {
    onChange(tono);
    setOpen(false);
  };

  return (
    <>
      <Touchable
        fade
        onPress={abrir}
        fd="row"
        ai="center"
        h={52}
        gap="$sm"
        br="$md"
        bw={1.5}
        px={14}
        bg="$surface"
        bc="$line"
      >
        <Muestra hex={value} />
        {/* Si el hex guardado no está en el catálogo se dice, en vez de
            mostrar el primer color como si fuera el del vehículo. */}
        <Txt f={1} fos={14} tone={elegido ? 'ink' : 'muted'} numberOfLines={1}>
          {elegido ? elegido.name : 'Otro color'}
        </Txt>
        <Icon name="chevD" color={c.muted} size={20} />
      </Touchable>

      <HojaModal
        open={open}
        onClose={() => setOpen(false)}
        titulo="Color del vehículo"
        alta
        pie={
          <Btn
            kind="primary"
            size="lg"
            icon={<Icon name="check" color={c.solidInk} size={18} />}
            onPress={confirmar}
          >
            {mismo(tono, value) ? 'Mantener este color' : 'Usar este color'}
          </Btn>
        }
      >
        <ScrollView contentContainerStyle={{ paddingBottom: 16 }}>
          {/* Vista previa: la tarjeta real del garaje sobre un fondo teñido
              con el tono, que se repinta con cada toque. */}
          <Box
            mx="$xl"
            br="$lg"
            p="$md"
            gap="$md"
            bg={esHex6(tono) ? `${tono}26` : '$bg2'}
            transition="quick"
          >
            <Row jc="space-between" ai="center">
              <Txt font="bold" fos={11} tone="muted" ls={1.2} caps>
                Así se verá en tu garaje
              </Txt>
              <Icon name="eye" color={c.muted} size={16} />
            </Row>

            {vehiculo ? (
              <VehicleCard
                vehiculo={{
                  ...vehiculo,
                  brand: vehiculo.brand || 'Tu',
                  model: vehiculo.model || (vehiculo.kind === 'car' ? 'carro' : 'moto'),
                  plate: vehiculo.plate || '—',
                  color: tono,
                }}
              />
            ) : (
              <Box als="center">
                <VehicleThumb kind="car" color={tono} size={88} />
              </Box>
            )}

            <Row gap="$sm" ai="center" jc="center">
              <Muestra hex={tono} size={14} />
              <Txt font="semi" fos={14}>
                {probando ? probando.name : 'Otro color'}
              </Txt>
              <Txt font="mono" fos={12} tone="muted2">
                {tono.toUpperCase()}
              </Txt>
            </Row>
          </Box>

          <Txt font="bold" fos={11} tone="muted" ls={1.2} caps px="$2xl" pt="$xl" pb="$md">
            Elige un color
          </Txt>

          <Row flexWrap="wrap" px="$md">
            {colores.map((item) => {
              const activo = mismo(item.hex, tono);
              return (
                <Touchable
                  key={item.hex}
                  width="25%"
                  ai="center"
                  gap={6}
                  py="$sm"
                  fade
                  onPress={() => setTono(item.hex)}
                >
                  {/* El anillo va siempre, transparente si no está activo:
                      así la muestra no salta de tamaño al elegirla. */}
                  <Box
                    p={3}
                    br="$pill"
                    bw={2.5}
                    bc={activo ? '$accent' : 'transparent'}
                    transition="quick"
                  >
                    <Box h={48} w={48} br="$pill" bg={item.hex} bw={1} bc="$line" ai="center" jc="center">
                      {activo ? (
                        <Icon name="check" color={esClaro(item.hex) ? '#111827' : '#FFFFFF'} size={20} />
                      ) : null}
                    </Box>
                  </Box>
                  <Txt
                    fos={11}
                    font={activo ? 'bold' : 'sans'}
                    tone={activo ? 'accent' : 'muted'}
                    numberOfLines={1}
                    px={4}
                  >
                    {item.name}
                  </Txt>
                </Touchable>
              );
            })}
          </Row>
        </ScrollView>
      </HojaModal>
    </>
  );
}
