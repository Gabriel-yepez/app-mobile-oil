// Primitivas — botones, inputs, cards, pills, KPI. Migradas del handoff.
//
// Todo el color sale de tokens de tema, así que cada componente sirve en claro
// y oscuro sin ramificar. La excepción es el prop `onDark`: marca los elementos
// que viven sobre el hero navy, que es oscuro en AMBOS temas.
// (Antes este prop se llamaba `dark`, lo que se confundía con el modo oscuro.)
import React, { ReactNode, useState } from 'react';
import { FlatList, Modal, StyleProp, TextInputProps, ViewStyle } from 'react-native';
import Svg, { Line } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { Box, Col, NativeInput, Row, Touchable, Txt, useAppColors, useShadows } from '../ui';
import { palette } from '../theme';
import { Icon } from './Icon';
import { VehicleStatus } from '../data/mock';

// ────────────────────────────────────────────
// Botón
// ────────────────────────────────────────────
type BtnKind = 'primary' | 'accent' | 'ghost' | 'soft' | 'danger';
type BtnSize = 'lg' | 'md' | 'sm';

const btnSize: Record<BtnSize, { height: number; px: number; fontSize: number }> = {
  lg: { height: 56, px: 22, fontSize: 16 },
  md: { height: 48, px: 18, fontSize: 15 },
  sm: { height: 36, px: 14, fontSize: 13 },
};

type BtnProps = {
  children: ReactNode;
  kind?: BtnKind;
  size?: BtnSize;
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
  textColor?: string;
  onPress?: () => void;
};

export function Btn({ children, kind = 'primary', size = 'md', icon, style, textColor, onPress }: BtnProps) {
  const c = useAppColors();
  const sh = useShadows();
  const s = btnSize[size];

  const surface: Record<BtnKind, ViewStyle> = {
    primary: { backgroundColor: c.solid, ...sh.primary },
    accent: { backgroundColor: c.accent, ...sh.primary },
    ghost: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: c.line },
    soft: { backgroundColor: c.bg2 },
    danger: { backgroundColor: c.dangerBg },
  };
  const ink: Record<BtnKind, string> = {
    primary: c.solidInk,
    accent: '#FFFFFF',
    ghost: c.primary,
    soft: c.primary,
    danger: c.dangerInk,
  };

  return (
    <Touchable
      onPress={onPress}
      fade
      sink
      transition="quick"
      fd="row"
      ai="center"
      jc="center"
      gap="$sm"
      br="$md"
      h={s.height}
      px={s.px}
      style={[surface[kind], style] as StyleProp<ViewStyle>}
    >
      {icon}
      <Txt font="semi" fos={s.fontSize} ls={-0.1} col={textColor ?? ink[kind]}>
        {children}
      </Txt>
    </Touchable>
  );
}

// ────────────────────────────────────────────
// Field (label + hint)
// ────────────────────────────────────────────
type FieldProps = { label?: string; hint?: string; suffix?: string; children: ReactNode };

export function Field({ label, hint, suffix, children }: FieldProps) {
  return (
    <Col gap="$sm">
      {label ? (
        <Row ai="baseline" jc="space-between" gap="$sm">
          <Txt numberOfLines={1} font="bold" fos={11} tone="muted" ls={0.6} caps>
            {label}
          </Txt>
          {suffix ? <Txt fos={11} tone="muted2">{suffix}</Txt> : null}
        </Row>
      ) : null}
      {children}
      {hint ? <Txt fos={12} tone="muted2">{hint}</Txt> : null}
    </Col>
  );
}

// ────────────────────────────────────────────
// Input
// ────────────────────────────────────────────
type InputProps = {
  mono?: boolean;
  prefix?: string;
  right?: ReactNode;
} & TextInputProps;

export function Input({ mono = false, prefix, right, style, ...rest }: InputProps) {
  const [focused, setFocused] = useState(false);
  const c = useAppColors();

  return (
    <Row
      h={52}
      gap="$sm"
      br="$md"
      bw={1.5}
      px={14}
      bg="$surface"
      bc={focused ? '$accent' : '$line'}
      transition="quick"
    >
      {prefix ? (
        <Txt font={mono ? 'monoMed' : 'sans'} fos={14} tone="muted">
          {prefix}
        </Txt>
      ) : null}
      <NativeInput
        {...rest}
        onFocus={(e) => {
          setFocused(true);
          rest.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          rest.onBlur?.(e);
        }}
        placeholderTextColor={c.muted2}
        f={1}
        py={0}
        col="$ink"
        fos={mono ? 16 : 15}
        ls={mono ? 0 : -0.1}
        fontFamily={mono ? '$mono' : '$body'}
        fontWeight={mono ? '600' : '500'}
        style={style}
      />
      {right}
    </Row>
  );
}

// ────────────────────────────────────────────
// Select (abre Modal con opciones)
// ────────────────────────────────────────────
type SelectProps = {
  value?: string;
  placeholder?: string;
  options: string[];
  onChange?: (value: string) => void;
};

export function Select({ value, placeholder = 'Seleccionar', options, onChange }: SelectProps) {
  const [open, setOpen] = useState(false);
  const c = useAppColors();

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
        <Txt f={1} fos={15} tone={value ? 'ink' : 'muted2'}>
          {value || placeholder}
        </Txt>
        <Icon name="chevD" color={c.muted} size={20} />
      </Touchable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Touchable f={1} jc="flex-end" bg="$scrim" onPress={() => setOpen(false)}>
          <Box
            maxHeight={420}
            borderTopLeftRadius="$xl"
            borderTopRightRadius="$xl"
            bg="$surface"
            py="$md"
            transition="bouncy"
            enterStyle={{ y: 40, opacity: 0 }}
          >
            <FlatList
              data={options}
              keyExtractor={(o) => o}
              renderItem={({ item }) => {
                const selected = item === value;
                return (
                  <Touchable
                    fd="row"
                    ai="center"
                    px="$2xl"
                    py={15}
                    pressStyle={{ bg: '$bg2' }}
                    onPress={() => {
                      onChange?.(item);
                      setOpen(false);
                    }}
                  >
                    <Txt f={1} fos={15} font={selected ? 'bold' : 'sans'} tone={selected ? 'accent' : 'ink'}>
                      {item}
                    </Txt>
                    {selected ? <Icon name="check" color={c.accent} size={18} /> : null}
                  </Touchable>
                );
              }}
            />
          </Box>
        </Touchable>
      </Modal>
    </>
  );
}

// ────────────────────────────────────────────
// Status pill (estilo LED)
// ────────────────────────────────────────────
const pillMeta: Record<VehicleStatus, { label: string; soft: keyof ReturnType<typeof useAppColors>; solid: keyof ReturnType<typeof useAppColors> }> = {
  ok: { label: 'Al día', soft: 'okSoft', solid: 'ok' },
  warn: { label: 'Próximo', soft: 'warnSoft', solid: 'warn' },
  danger: { label: 'Vencido', soft: 'dangerSoft', solid: 'danger' },
};

export function StatusPill({ status = 'ok', label }: { status?: VehicleStatus; label?: string }) {
  const c = useAppColors();
  const m = pillMeta[status];
  const solid = c[m.solid] as string;

  return (
    <Row h={24} gap={6} br="$pill" px={10} bg={c[m.soft] as string} transition="lazy">
      <Box
        h={6}
        w={6}
        br="$pill"
        bg={solid}
        shadowColor={solid}
        shadowOpacity={0.9}
        shadowRadius={4}
        shadowOffset={{ width: 0, height: 0 }}
      />
      <Txt font="bold" fos={11} ls={0.4} caps col={solid}>
        {label || m.label}
      </Txt>
    </Row>
  );
}

// ────────────────────────────────────────────
// Section header (UPPER-CASE técnico)
// ────────────────────────────────────────────
export function SectionHead({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <Row mb={10} jc="space-between" px="$xl">
      <Row gap="$sm">
        <Box h={14} w={4} br={2} bg="$accent" />
        <Txt font="bold" fos={11} tone="muted" ls={1.2} caps>
          {children}
        </Txt>
      </Row>
      {right}
    </Row>
  );
}

// ────────────────────────────────────────────
// Card
// ────────────────────────────────────────────
// Acepta además las props de layout de Box (fd, ai, gap…), que es como las
// pantallas ajustan la disposición interna de cada tarjeta.
type CardProps = React.ComponentProps<typeof Box> & {
  children: ReactNode;
  padded?: boolean;
  /** Sobre el hero navy (oscuro en ambos temas), no "modo oscuro". */
  onDark?: boolean;
};

export function Card({ children, padded = true, onDark = false, style, ...rest }: CardProps) {
  const sh = useShadows();
  return (
    <Box
      br="$lg"
      bw={1}
      bg={onDark ? '$primary2' : '$surface'}
      bc={onDark ? 'rgba(255,255,255,0.08)' : '$line'}
      p={padded ? '$lg' : 0}
      ov={padded ? 'visible' : 'hidden'}
      style={[onDark ? null : sh.card, style] as StyleProp<ViewStyle>}
      {...rest}
    >
      {children}
    </Box>
  );
}

// ────────────────────────────────────────────
// KPI tile
// ────────────────────────────────────────────
type KPIProps = {
  icon: ReactNode;
  label: string;
  value: string | number;
  unit?: string;
  onDark?: boolean;
};

export function KPI({ icon, label, value, unit, onDark = false }: KPIProps) {
  return (
    <Col
      f={1}
      gap="$sm"
      br="$md"
      bw={1}
      p={14}
      bg={onDark ? 'rgba(255,255,255,0.06)' : '$bg2'}
      bc={onDark ? 'rgba(255,255,255,0.06)' : '$line2'}
    >
      <Row gap="$sm">
        <Box h={28} w={28} ai="center" jc="center" br={8} bg={onDark ? 'rgba(255,255,255,0.08)' : '$accentSoft'}>
          {icon}
        </Box>
        <Txt numberOfLines={1} f={1} font="bold" fos={10} ls={0.4} caps tone={onDark ? 'onDarkMuted' : 'muted'}>
          {label}
        </Txt>
      </Row>
      <Row ai="baseline" gap={4}>
        <Txt font="mono" fos={24} ls={-0.5} tone={onDark ? 'onDark' : 'ink'}>
          {value}
        </Txt>
        {unit ? (
          <Txt fos={12} tone={onDark ? 'onDarkMuted' : 'muted'}>
            {unit}
          </Txt>
        ) : null}
      </Row>
    </Col>
  );
}

// ────────────────────────────────────────────
// VinPlate (sticker técnico para hero oscuro)
// ────────────────────────────────────────────
export function VinPlate({ children }: { children: ReactNode }) {
  return (
    <Row h={22} br={4} bw={1} px="$sm" bc="rgba(255,255,255,0.12)" bg="rgba(255,255,255,0.06)">
      <Txt font="monoMed" fos={11} ls={1} tone="onDarkSoft">
        {children}
      </Txt>
    </Row>
  );
}

// ────────────────────────────────────────────
// Thumbnail de vehículo (gradiente del color + icono)
// ────────────────────────────────────────────
export function VehicleThumb({
  kind,
  color = '#1F2937',
  size = 56,
}: {
  kind: 'car' | 'moto';
  color?: string;
  size?: number;
}) {
  return (
    <LinearGradient
      colors={[color, `${color}cc`]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        width: size,
        height: size,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon name={kind === 'moto' ? 'moto' : 'car'} color="rgba(255,255,255,0.95)" size={size * 0.55} />
    </LinearGradient>
  );
}

// ────────────────────────────────────────────
// Avatar con iniciales (gradiente de marca)
// ────────────────────────────────────────────
/** "Gabriel Yepez Pérez" → "GY". Ignora espacios sobrantes y nombres vacíos. */
export function initialsOf(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

// El gradiente sale de `palette` y no de los tokens de tema porque el avatar
// vive sobre el hero navy, que es oscuro en claro y en oscuro: así se ve igual
// en ambos. `ring` es el aro blanco que lo despega del fondo.
export function Avatar({
  name,
  size = 44,
  ring = 2,
  onPress,
}: {
  name: string;
  size?: number;
  ring?: number;
  onPress?: () => void;
}) {
  const circle = (
    <LinearGradient
      colors={[palette.accent2, palette.primary]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: ring,
        borderColor: 'rgba(255,255,255,0.2)',
      }}
    >
      <Txt font="display" fos={Math.round(size * 0.36)} tone="onDark">
        {initialsOf(name)}
      </Txt>
    </LinearGradient>
  );

  if (!onPress) return circle;

  return (
    <Touchable onPress={onPress} fade="strong" sink transition="quick" br={size / 2} hitSlop={8}>
      {circle}
    </Touchable>
  );
}

// ────────────────────────────────────────────
// Grid técnico (overlay para headers oscuros)
// ────────────────────────────────────────────
export function TechGrid({ width = 500, height = 420, light = true }: { width?: number; height?: number; light?: boolean }) {
  const gap = 24;
  const stroke = light ? 'rgba(255,255,255,0.04)' : 'rgba(10,37,64,0.04)';
  const vLines = Math.ceil(width / gap);
  const hLines = Math.ceil(height / gap);
  return (
    <Box pos="absolute" t={0} l={0} r={0} b={0} pointerEvents="none">
      <Svg width={width} height={height}>
        {Array.from({ length: vLines }).map((_, i) => (
          <Line key={`v${i}`} x1={i * gap} y1={0} x2={i * gap} y2={height} stroke={stroke} strokeWidth={1} />
        ))}
        {Array.from({ length: hLines }).map((_, i) => (
          <Line key={`h${i}`} x1={0} y1={i * gap} x2={width} y2={i * gap} stroke={stroke} strokeWidth={1} />
        ))}
      </Svg>
    </Box>
  );
}

// ────────────────────────────────────────────
// Botón cuadrado de icono (back, edit, search…)
// ────────────────────────────────────────────
export function IconBtn({
  icon,
  onPress,
  onDark = false,
  filled = false,
  size = 36,
}: {
  icon: ReactNode;
  onPress?: () => void;
  onDark?: boolean;
  filled?: boolean;
  size?: number;
}) {
  const sh = useShadows();
  return (
    <Touchable
      onPress={onPress}
      fade="strong"
      transition="quick"
      ai="center"
      jc="center"
      br={12}
      w={size}
      h={size}
      bg={filled ? '$solid' : onDark ? 'rgba(255,255,255,0.12)' : '$surface'}
      bw={filled || onDark ? 0 : 1.5}
      bc="$line"
      style={filled ? sh.primary : undefined}
    >
      {icon}
    </Touchable>
  );
}
