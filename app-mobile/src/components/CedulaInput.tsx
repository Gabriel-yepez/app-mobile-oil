// Cédula con su letra: V, E, J o G.
//
// La letra no se teclea, se elige: así llega siempre en mayúscula y siempre
// una de las cuatro que acepta el backend (`^[VEJG]\d{6,9}$`). El número, en
// cambio, sí se escribe, y solo admite dígitos y puntos —el teclado numérico
// de iOS no impide pegar texto.
import React, { useState } from 'react';
import { TextInputProps } from 'react-native';
import { Box, Touchable, Txt, useAppColors } from '../ui';
import { HojaModal, Input } from './primitives';
import { Icon } from './Icon';

export type TipoCedula = 'V' | 'E' | 'J' | 'G';

export const TIPOS_CEDULA: { tipo: TipoCedula; nombre: string }[] = [
  { tipo: 'V', nombre: 'Venezolano' },
  { tipo: 'E', nombre: 'Extranjero' },
  { tipo: 'J', nombre: 'Jurídico (empresa)' },
  { tipo: 'G', nombre: 'Gubernamental' },
];

type CedulaInputProps = {
  tipo: TipoCedula;
  onTipoChange: (tipo: TipoCedula) => void;
  numero: string;
  onNumeroChange: (numero: string) => void;
  invalid?: boolean;
} & Pick<TextInputProps, 'placeholder' | 'returnKeyType' | 'onSubmitEditing'>;

export function CedulaInput({
  tipo,
  onTipoChange,
  numero,
  onNumeroChange,
  invalid,
  placeholder = '25.481.073',
  ...rest
}: CedulaInputProps) {
  const c = useAppColors();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Input
        value={numero}
        onChangeText={(v) => onNumeroChange(v.replace(/[^\d.]/g, ''))}
        placeholder={placeholder}
        mono
        keyboardType="number-pad"
        invalid={invalid}
        {...rest}
        left={
          <Touchable
            onPress={() => setOpen(true)}
            fade
            hitSlop={8}
            fd="row"
            ai="center"
            gap={4}
            h="100%"
            pr={10}
            mr={2}
            borderRightWidth={1.5}
            borderRightColor="$line"
            aria-label={`Tipo de documento: ${tipo}. Toca para cambiarlo`}
          >
            <Txt font="monoMed" fos={16} tone="ink">
              {tipo}
            </Txt>
            <Icon name="chevD" color={c.muted} size={16} />
          </Touchable>
        }
      />

      <HojaModal open={open} onClose={() => setOpen(false)}>
        <Txt font="bold" fos={11} tone="muted" ls={0.6} caps px="$2xl" pt="$sm" pb="$sm">
          Tipo de documento
        </Txt>
        {TIPOS_CEDULA.map((t) => {
          const selected = t.tipo === tipo;
          return (
            <Touchable
              key={t.tipo}
              fd="row"
              ai="center"
              gap={14}
              px="$2xl"
              py={13}
              pressStyle={{ bg: '$bg2' }}
              onPress={() => {
                onTipoChange(t.tipo);
                setOpen(false);
              }}
            >
              <Box
                h={34}
                w={34}
                br={10}
                ai="center"
                jc="center"
                bg={selected ? '$accentSoft' : '$bg2'}
              >
                <Txt font="mono" fos={16} tone={selected ? 'accent' : 'ink'}>
                  {t.tipo}
                </Txt>
              </Box>
              <Txt f={1} fos={15} font={selected ? 'bold' : 'sans'} tone={selected ? 'accent' : 'ink'}>
                {t.nombre}
              </Txt>
              {selected ? <Icon name="check" color={c.accent} size={18} /> : null}
            </Touchable>
          );
        })}
      </HojaModal>
    </>
  );
}
