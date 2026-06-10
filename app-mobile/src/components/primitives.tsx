// Primitivas — botones, inputs, cards, pills, KPI. Migradas del handoff (src/primitives.jsx)
import React, { ReactNode, useState } from 'react';
import { FlatList, Modal, StyleProp, ViewStyle } from 'react-native';
import Svg, { Line } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Pressable, Text, TextInput, View } from '../tw';
import type { TextInputProps } from 'react-native';
import { palette, T } from '../theme';
import { Icon } from './Icon';
import { VehicleStatus } from '../data/mock';

// ────────────────────────────────────────────
// Botón
// ────────────────────────────────────────────
type BtnKind = 'primary' | 'accent' | 'ghost' | 'soft' | 'danger';
type BtnSize = 'lg' | 'md' | 'sm';

type BtnProps = {
  children: ReactNode;
  kind?: BtnKind;
  size?: BtnSize;
  icon?: ReactNode;
  className?: string;
  style?: StyleProp<ViewStyle>;
  textColor?: string;
  onPress?: () => void;
};

const btnSizeCls: Record<BtnSize, string> = {
  lg: 'h-14 px-[22px]',
  md: 'h-12 px-[18px]',
  sm: 'h-9 px-3.5',
};

const btnTextSizeCls: Record<BtnSize, string> = {
  lg: 'text-[16px]',
  md: 'text-[15px]',
  sm: 'text-[13px]',
};

const btnKindCls: Record<BtnKind, string> = {
  primary: 'bg-primary shadow-primary',
  accent: 'bg-accent shadow-primary',
  ghost: 'bg-transparent border-[1.5px] border-line',
  soft: 'bg-bg2',
  danger: 'bg-[#FEE2E2]',
};

const btnKindTextCls: Record<BtnKind, string> = {
  primary: 'text-white',
  accent: 'text-white',
  ghost: 'text-primary',
  soft: 'text-primary',
  danger: 'text-[#B91C1C]',
};

export function Btn({ children, kind = 'primary', size = 'md', icon, className, style, textColor, onPress }: BtnProps) {
  return (
    <Pressable
      onPress={onPress}
      className={twMerge(
        clsx(
          'flex-row items-center justify-center gap-2 rounded-md active:opacity-85',
          btnSizeCls[size],
          btnKindCls[kind],
          className
        )
      )}
      style={style}
    >
      {icon}
      <Text
        className={clsx('font-sans-semi tracking-[-0.1px]', btnTextSizeCls[size], btnKindTextCls[kind])}
        style={textColor ? { color: textColor } : undefined}
      >
        {children}
      </Text>
    </Pressable>
  );
}

// ────────────────────────────────────────────
// Field (label + hint)
// ────────────────────────────────────────────
type FieldProps = { label?: string; hint?: string; suffix?: string; children: ReactNode };

export function Field({ label, hint, suffix, children }: FieldProps) {
  return (
    <View className="gap-2">
      {label ? (
        <View className="flex-row items-baseline justify-between gap-2">
          <Text numberOfLines={1} className="font-sans-bold text-[11px] text-muted tracking-[0.6px] uppercase">
            {label}
          </Text>
          {suffix ? <Text className="font-sans text-[11px] text-muted2">{suffix}</Text> : null}
        </View>
      ) : null}
      {children}
      {hint ? <Text className="font-sans text-[12px] text-muted2">{hint}</Text> : null}
    </View>
  );
}

// ────────────────────────────────────────────
// Input
// ────────────────────────────────────────────
const inputBoxCls = 'h-[52px] flex-row items-center gap-2 rounded-md border-[1.5px] border-line bg-white px-3.5';

type InputProps = {
  mono?: boolean;
  prefix?: string;
  right?: ReactNode;
} & TextInputProps;

export function Input({ mono = false, prefix, right, style, ...rest }: InputProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View
      className={clsx(
        inputBoxCls,
        focused && 'border-accent shadow-[0px_0px_3px_rgba(37,99,235,0.18)]'
      )}
    >
      {prefix ? (
        <Text className={clsx('text-[14px] text-muted', mono ? 'font-mono-med' : 'font-sans')}>{prefix}</Text>
      ) : null}
      <TextInput
        {...rest}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholderTextColor={T.muted2}
        className={clsx(
          'flex-1 py-0 text-ink',
          mono ? 'font-mono-med text-[16px]' : 'font-sans text-[15px] tracking-[-0.1px]'
        )}
        style={style}
      />
      {right}
    </View>
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
  return (
    <>
      <Pressable className={inputBoxCls} onPress={() => setOpen(true)}>
        <Text className={clsx('flex-1 font-sans text-[15px]', value ? 'text-ink' : 'text-muted2')}>
          {value || placeholder}
        </Text>
        <Icon name="chevD" color={T.muted} size={20} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable className="flex-1 justify-end bg-[rgba(10,18,38,0.4)]" onPress={() => setOpen(false)}>
          <View className="max-h-[420px] rounded-t-xl bg-white py-3">
            <FlatList
              data={options}
              keyExtractor={(o) => o}
              renderItem={({ item }) => {
                const selected = item === value;
                return (
                  <Pressable
                    className="flex-row items-center px-6 py-[15px] active:bg-bg2"
                    onPress={() => {
                      onChange?.(item);
                      setOpen(false);
                    }}
                  >
                    <Text
                      className={clsx(
                        'flex-1 text-[15px]',
                        selected ? 'font-sans-bold text-accent' : 'font-sans text-ink'
                      )}
                    >
                      {item}
                    </Text>
                    {selected ? <Icon name="check" color={palette.accent} size={18} /> : null}
                  </Pressable>
                );
              }}
            />
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

// ────────────────────────────────────────────
// Status pill (estilo LED)
// ────────────────────────────────────────────
const pillMap: Record<VehicleStatus, { bgCls: string; dotCls: string; textCls: string; label: string }> = {
  ok: {
    bgCls: 'bg-[#ECFDF5]',
    dotCls: 'bg-ok shadow-[0px_0px_4px_rgba(16,185,129,0.9)]',
    textCls: 'text-ok',
    label: 'Al día',
  },
  warn: {
    bgCls: 'bg-[#FFFBEB]',
    dotCls: 'bg-warn shadow-[0px_0px_4px_rgba(245,158,11,0.9)]',
    textCls: 'text-warn',
    label: 'Próximo',
  },
  danger: {
    bgCls: 'bg-[#FEF2F2]',
    dotCls: 'bg-danger shadow-[0px_0px_4px_rgba(239,68,68,0.9)]',
    textCls: 'text-danger',
    label: 'Vencido',
  },
};

export function StatusPill({ status = 'ok', label }: { status?: VehicleStatus; label?: string }) {
  const s = pillMap[status];
  return (
    <View className={clsx('h-6 flex-row items-center gap-1.5 rounded-full px-2.5', s.bgCls)}>
      <View className={clsx('h-1.5 w-1.5 rounded-full', s.dotCls)} />
      <Text className={clsx('font-sans-bold text-[11px] tracking-[0.4px] uppercase', s.textCls)}>
        {label || s.label}
      </Text>
    </View>
  );
}

// ────────────────────────────────────────────
// Section header (UPPER-CASE técnico)
// ────────────────────────────────────────────
export function SectionHead({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <View className="mb-2.5 flex-row items-center justify-between px-5">
      <View className="flex-row items-center gap-2">
        <View className="h-3.5 w-1 rounded-[2px] bg-accent" />
        <Text className="font-sans-bold text-[11px] text-muted tracking-[1.2px] uppercase">{children}</Text>
      </View>
      {right}
    </View>
  );
}

// ────────────────────────────────────────────
// Card
// ────────────────────────────────────────────
type CardProps = {
  children: ReactNode;
  padded?: boolean;
  dark?: boolean;
  className?: string;
  style?: StyleProp<ViewStyle>;
};

export function Card({ children, padded = true, dark = false, className, style }: CardProps) {
  return (
    <View
      className={twMerge(
        clsx(
          'rounded-lg border',
          dark ? 'bg-primary2 border-[rgba(255,255,255,0.08)]' : 'bg-white border-line shadow-card',
          padded ? 'p-4' : 'overflow-hidden',
          className
        )
      )}
      style={style}
    >
      {children}
    </View>
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
  dark?: boolean;
};

export function KPI({ icon, label, value, unit, dark = false }: KPIProps) {
  return (
    <View
      className={clsx(
        'flex-1 gap-2 rounded-md border p-3.5',
        dark ? 'bg-[rgba(255,255,255,0.06)] border-[rgba(255,255,255,0.06)]' : 'bg-bg2 border-line2'
      )}
    >
      <View className="flex-row items-center gap-2">
        <View
          className={clsx(
            'h-7 w-7 items-center justify-center rounded-[8px]',
            dark ? 'bg-[rgba(255,255,255,0.08)]' : 'bg-[rgba(37,99,235,0.08)]'
          )}
        >
          {icon}
        </View>
        <Text
          numberOfLines={1}
          className={clsx(
            'flex-1 font-sans-bold text-[10px] tracking-[0.4px] uppercase',
            dark ? 'text-[rgba(255,255,255,0.6)]' : 'text-muted'
          )}
        >
          {label}
        </Text>
      </View>
      <View className="flex-row items-baseline gap-1">
        <Text className={clsx('font-mono text-[24px] tracking-[-0.5px]', dark ? 'text-white' : 'text-ink')}>
          {value}
        </Text>
        {unit ? (
          <Text className={clsx('font-sans text-[12px]', dark ? 'text-[rgba(255,255,255,0.6)]' : 'text-muted')}>
            {unit}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

// ────────────────────────────────────────────
// VinPlate (sticker técnico para hero oscuro)
// ────────────────────────────────────────────
export function VinPlate({ children }: { children: ReactNode }) {
  return (
    <View className="h-[22px] flex-row items-center rounded-[4px] border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.06)] px-2">
      <Text className="font-mono-med text-[11px] text-[rgba(255,255,255,0.7)] tracking-[1px]">{children}</Text>
    </View>
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
// Grid técnico (overlay para headers oscuros)
// ────────────────────────────────────────────
export function TechGrid({ width = 500, height = 420, light = true }: { width?: number; height?: number; light?: boolean }) {
  const gap = 24;
  const stroke = light ? 'rgba(255,255,255,0.04)' : 'rgba(10,37,64,0.04)';
  const vLines = Math.ceil(width / gap);
  const hLines = Math.ceil(height / gap);
  return (
    <View className="absolute inset-0" pointerEvents="none">
      <Svg width={width} height={height}>
        {Array.from({ length: vLines }).map((_, i) => (
          <Line key={`v${i}`} x1={i * gap} y1={0} x2={i * gap} y2={height} stroke={stroke} strokeWidth={1} />
        ))}
        {Array.from({ length: hLines }).map((_, i) => (
          <Line key={`h${i}`} x1={0} y1={i * gap} x2={width} y2={i * gap} stroke={stroke} strokeWidth={1} />
        ))}
      </Svg>
    </View>
  );
}

// ────────────────────────────────────────────
// Botón cuadrado de icono (back, edit, search…)
// ────────────────────────────────────────────
export function IconBtn({
  icon,
  onPress,
  dark = false,
  filled = false,
  size = 36,
}: {
  icon: ReactNode;
  onPress?: () => void;
  dark?: boolean;
  filled?: boolean;
  size?: number;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={clsx(
        'items-center justify-center rounded-[12px] active:opacity-70',
        filled
          ? 'bg-primary shadow-primary'
          : dark
            ? 'bg-[rgba(255,255,255,0.12)]'
            : 'border-[1.5px] border-line bg-white'
      )}
      style={{ width: size, height: size }}
    >
      {icon}
    </Pressable>
  );
}
