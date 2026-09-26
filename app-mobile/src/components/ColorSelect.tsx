// Selector de color del vehículo: una muestra del tono y su nombre, y al
// tocarlo una hoja con todo el catálogo.
//
// Antes esto CICLABA: cada toque pasaba al siguiente color, así que llegar al
// décimo eran nueve toques y no había forma de ver qué colores existían.
import React, { useState } from 'react';
import { FlatList } from 'react-native';
import { Box, Row, Touchable, Txt, useAppColors } from '../ui';
import { HojaModal } from './primitives';
import { Icon } from './Icon';
import { useColors } from '../store/useColors';
import type { ApiColor } from '../api/controllers/colors.controller';

type Props = {
  /** El hex guardado. Puede no estar en el catálogo. */
  value: string;
  onChange: (hex: string) => void;
};

/** La muestra circular. El borde importa: sin él, el blanco y el beige se
 *  pierden contra la tarjeta y parecen un hueco. */
function Muestra({ hex, size = 22 }: { hex: string; size?: number }) {
  return <Box h={size} w={size} br="$pill" bg={hex} bw={1} bc="$line" />;
}

export function ColorSelect({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const c = useAppColors();
  const colores = useColors((s) => s.colores);

  const elegido: ApiColor | null =
    colores.find((x) => x.hex.toUpperCase() === value.toUpperCase()) ?? null;

  return (
    <>
      <Touchable
        fade
        onPress={() => setOpen(true)}
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
        <Txt f={1} fos={14} tone={elegido ? 'ink' : 'muted'}>
          {elegido ? elegido.name : 'Otro color'}
        </Txt>
        <Icon name="chevD" color={c.muted} size={20} />
      </Touchable>

      <HojaModal open={open} onClose={() => setOpen(false)}>
        <FlatList
          data={colores}
          keyExtractor={(x) => x.hex}
          renderItem={({ item }) => {
            const selected = item.hex.toUpperCase() === value.toUpperCase();
            return (
              <Touchable
                fd="row"
                ai="center"
                gap="$md"
                px="$2xl"
                py={15}
                pressStyle={{ bg: '$bg2' }}
                onPress={() => {
                  onChange(item.hex);
                  setOpen(false);
                }}
              >
                <Muestra hex={item.hex} size={26} />
                <Txt
                  f={1}
                  fos={15}
                  font={selected ? 'bold' : 'sans'}
                  tone={selected ? 'accent' : 'ink'}
                >
                  {item.name}
                </Txt>
                {selected ? <Icon name="check" color={c.accent} size={18} /> : null}
              </Touchable>
            );
          }}
        />
      </HojaModal>
    </>
  );
}
