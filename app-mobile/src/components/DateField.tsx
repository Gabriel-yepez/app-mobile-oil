// Campo de fecha: se toca y abre un calendario en la hoja de abajo.
//
// Calendario propio y no el selector nativo a propósito: el nativo es un
// módulo que obliga a recompilar la app, y este se ve igual que el resto de
// las hojas (marcas, talleres, color) en iOS y en Android.
//
// Trabaja en UTC de punta a punta, igual que fmtFecha y el backend: el valor
// es la medianoche UTC del día elegido. "Hoy" sí es el día del teléfono, que
// es el que el usuario tiene en la cabeza.
import React, { useState } from 'react';
import { Box, Row, Touchable, Txt, useAppColors } from '../ui';
import { HojaModal } from './primitives';
import { Icon } from './Icon';
import { fmtFecha, fmtHace } from '../utils/format';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
// La semana arranca el lunes, como en los calendarios de Venezuela.
const DIAS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const DIA_MS = 86_400_000;

type Props = {
  /** ISO, medianoche UTC. */
  value: string;
  onChange: (iso: string) => void;
  titulo?: string;
  /** Sin fechas futuras: un cambio de aceite no se registra por adelantado. */
  noFuturo?: boolean;
};

const hoyUtc = () => {
  const d = new Date();
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
};

/** Las semanas del mes, con null en los huecos antes del 1 y después del último. */
function semanasDe(anio: number, mes: number): (number | null)[][] {
  const vacios = (new Date(Date.UTC(anio, mes, 1)).getUTCDay() + 6) % 7;
  const dias = new Date(Date.UTC(anio, mes + 1, 0)).getUTCDate();
  const celdas: (number | null)[] = [
    ...Array<null>(vacios).fill(null),
    ...Array.from({ length: dias }, (_, i) => i + 1),
  ];
  while (celdas.length % 7 !== 0) celdas.push(null);
  return Array.from({ length: celdas.length / 7 }, (_, i) =>
    celdas.slice(i * 7, i * 7 + 7),
  );
}

export function DateField({ value, onChange, titulo = 'Elige la fecha', noFuturo = false }: Props) {
  const c = useAppColors();
  const [open, setOpen] = useState(false);
  const elegido = new Date(value);
  const [vista, setVista] = useState({ anio: elegido.getUTCFullYear(), mes: elegido.getUTCMonth() });

  const hoy = hoyUtc();
  const hoyD = new Date(hoy);
  const esMesActual = vista.anio === hoyD.getUTCFullYear() && vista.mes === hoyD.getUTCMonth();

  const abrir = () => {
    setVista({ anio: elegido.getUTCFullYear(), mes: elegido.getUTCMonth() });
    setOpen(true);
  };

  const elegir = (ms: number) => {
    onChange(new Date(ms).toISOString());
    setOpen(false);
  };

  const mover = (delta: number) => {
    const d = new Date(Date.UTC(vista.anio, vista.mes + delta, 1));
    setVista({ anio: d.getUTCFullYear(), mes: d.getUTCMonth() });
  };

  const atajos = [
    { label: 'Hoy', ms: hoy },
    { label: 'Ayer', ms: hoy - DIA_MS },
    { label: 'Hace una semana', ms: hoy - 7 * DIA_MS },
  ];

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
        <Icon name="calendar" color={c.muted} size={18} />
        <Txt f={1} font="monoMed" fos={14} numberOfLines={1}>
          {fmtFecha(value)}
        </Txt>
        <Txt fos={11} tone="muted2">{fmtHace(value)}</Txt>
      </Touchable>

      <HojaModal open={open} onClose={() => setOpen(false)} titulo={titulo}>
        <Box px="$xl" pb="$md" gap="$md">
          <Row gap="$sm">
            {atajos.map((a) => {
              const activo = a.ms === elegido.getTime();
              return (
                <Touchable
                  key={a.label}
                  fade
                  onPress={() => elegir(a.ms)}
                  px="$md"
                  h={32}
                  jc="center"
                  br="$pill"
                  bw={1}
                  bc={activo ? '$accent' : '$line'}
                  bg={activo ? '$accentSoft' : 'transparent'}
                >
                  <Txt font="semi" fos={12} tone={activo ? 'accent' : 'ink'}>
                    {a.label}
                  </Txt>
                </Touchable>
              );
            })}
          </Row>

          <Row jc="space-between" ai="center">
            <Touchable fade onPress={() => mover(-1)} h={36} w={36} ai="center" jc="center" br="$pill" bg="$bg2">
              <Icon name="chevL" color={c.ink} size={18} />
            </Touchable>
            <Txt font="bold" fos={16}>
              {MESES[vista.mes]} {vista.anio}
            </Txt>
            <Touchable
              fade
              onPress={() => mover(1)}
              disabled={noFuturo && esMesActual}
              h={36}
              w={36}
              ai="center"
              jc="center"
              br="$pill"
              bg="$bg2"
              opacity={noFuturo && esMesActual ? 0.35 : 1}
            >
              <Icon name="chevR" color={c.ink} size={18} />
            </Touchable>
          </Row>

          <Box>
            <Row>
              {DIAS.map((d, i) => (
                <Txt key={i} f={1} ta="center" font="bold" fos={11} tone="muted2" pb="$sm">
                  {d}
                </Txt>
              ))}
            </Row>
            {semanasDe(vista.anio, vista.mes).map((semana, i) => (
              <Row key={i}>
                {semana.map((dia, j) => {
                  if (dia === null) return <Box key={j} f={1} h={44} />;
                  const ms = Date.UTC(vista.anio, vista.mes, dia);
                  const activo = ms === elegido.getTime();
                  const esHoy = ms === hoy;
                  const bloqueado = noFuturo && ms > hoy;
                  return (
                    <Touchable
                      key={j}
                      f={1}
                      h={44}
                      ai="center"
                      jc="center"
                      disabled={bloqueado}
                      onPress={() => elegir(ms)}
                    >
                      <Box
                        h={38}
                        w={38}
                        br="$pill"
                        ai="center"
                        jc="center"
                        bg={activo ? '$accent' : 'transparent'}
                        bw={esHoy && !activo ? 1.5 : 0}
                        bc="$accent"
                      >
                        <Txt
                          font={activo || esHoy ? 'bold' : 'monoMed'}
                          fos={14}
                          col={activo ? '#FFFFFF' : undefined}
                          tone={activo ? undefined : bloqueado ? 'muted2' : esHoy ? 'accent' : 'ink'}
                          opacity={bloqueado ? 0.4 : 1}
                        >
                          {dia}
                        </Txt>
                      </Box>
                    </Touchable>
                  );
                })}
              </Row>
            ))}
          </Box>
        </Box>
      </HojaModal>
    </>
  );
}
