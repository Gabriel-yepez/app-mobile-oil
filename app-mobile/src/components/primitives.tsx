// Primitivas — botones, inputs, cards, pills, KPI. Migradas del handoff (src/primitives.jsx)
import React, { ReactNode, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import Svg, { Line } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { fonts, palette, radius, shadow, T } from '../theme';
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
  style?: StyleProp<ViewStyle>;
  textColor?: string;
  onPress?: () => void;
};

export function Btn({ children, kind = 'primary', size = 'md', icon, style, textColor, onPress }: BtnProps) {
  const h = size === 'lg' ? 56 : size === 'sm' ? 36 : 48;
  const px = size === 'lg' ? 22 : size === 'sm' ? 14 : 18;
  const fs = size === 'lg' ? 16 : size === 'sm' ? 13 : 15;

  const kindStyle: Record<BtnKind, { bg: string; color: string; border?: boolean; glow?: boolean }> = {
    primary: { bg: palette.primary, color: '#fff', glow: true },
    accent: { bg: palette.accent, color: '#fff', glow: true },
    ghost: { bg: 'transparent', color: palette.primary, border: true },
    soft: { bg: T.bg2, color: palette.primary },
    danger: { bg: '#FEE2E2', color: '#B91C1C' },
  };
  const k = kindStyle[kind];

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          height: h,
          paddingHorizontal: px,
          borderRadius: radius.md,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          backgroundColor: k.bg,
          borderWidth: k.border ? 1.5 : 0,
          borderColor: T.line,
          opacity: pressed ? 0.85 : 1,
        },
        k.glow ? shadow.primary : null,
        style,
      ]}
    >
      {icon}
      <Text style={{ fontFamily: fonts.sansSemi, fontSize: fs, letterSpacing: -0.1, color: textColor ?? k.color }}>
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
    <View style={{ gap: 8 }}>
      {label ? (
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
          <Text
            numberOfLines={1}
            style={{
              fontFamily: fonts.sansBold,
              fontSize: 11,
              color: T.muted,
              letterSpacing: 0.6,
              textTransform: 'uppercase',
            }}
          >
            {label}
          </Text>
          {suffix ? <Text style={{ fontFamily: fonts.sans, fontSize: 11, color: T.muted2 }}>{suffix}</Text> : null}
        </View>
      ) : null}
      {children}
      {hint ? <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: T.muted2 }}>{hint}</Text> : null}
    </View>
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
  return (
    <View
      style={[
        styles.inputBox,
        focused && {
          borderColor: palette.accent,
          shadowColor: palette.accent,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.18,
          shadowRadius: 3,
          elevation: 2,
        },
      ]}
    >
      {prefix ? (
        <Text style={{ color: T.muted, fontFamily: mono ? fonts.monoMed : fonts.sans, fontSize: 14 }}>{prefix}</Text>
      ) : null}
      <TextInput
        {...rest}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholderTextColor={T.muted2}
        style={[
          {
            flex: 1,
            fontFamily: mono ? fonts.monoMed : fonts.sans,
            fontSize: mono ? 16 : 15,
            color: T.ink,
            letterSpacing: mono ? 0 : -0.1,
            paddingVertical: 0,
          },
          style,
        ]}
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
      <Pressable style={styles.inputBox} onPress={() => setOpen(true)}>
        <Text
          style={{
            flex: 1,
            fontFamily: fonts.sans,
            fontSize: 15,
            color: value ? T.ink : T.muted2,
          }}
        >
          {value || placeholder}
        </Text>
        <Icon name="chevD" color={T.muted} size={20} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setOpen(false)}>
          <View style={styles.modalSheet}>
            <FlatList
              data={options}
              keyExtractor={(o) => o}
              renderItem={({ item }) => {
                const selected = item === value;
                return (
                  <Pressable
                    style={({ pressed }) => [styles.modalRow, pressed && { backgroundColor: T.bg2 }]}
                    onPress={() => {
                      onChange?.(item);
                      setOpen(false);
                    }}
                  >
                    <Text
                      style={{
                        flex: 1,
                        fontFamily: selected ? fonts.sansBold : fonts.sans,
                        fontSize: 15,
                        color: selected ? palette.accent : T.ink,
                      }}
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
export function StatusPill({ status = 'ok', label }: { status?: VehicleStatus; label?: string }) {
  const map = {
    ok: { c: T.ok, bg: '#ECFDF5', label: label || 'Al día' },
    warn: { c: T.warn, bg: '#FFFBEB', label: label || 'Próximo' },
    danger: { c: T.danger, bg: '#FEF2F2', label: label || 'Vencido' },
  };
  const s = map[status];
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        height: 24,
        paddingHorizontal: 10,
        borderRadius: radius.pill,
        backgroundColor: s.bg,
      }}
    >
      <View
        style={{
          width: 6,
          height: 6,
          borderRadius: 3,
          backgroundColor: s.c,
          shadowColor: s.c,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.9,
          shadowRadius: 4,
          elevation: 2,
        }}
      />
      <Text
        style={{
          fontFamily: fonts.sansBold,
          fontSize: 11,
          color: s.c,
          letterSpacing: 0.4,
          textTransform: 'uppercase',
        }}
      >
        {s.label}
      </Text>
    </View>
  );
}

// ────────────────────────────────────────────
// Section header (UPPER-CASE técnico)
// ────────────────────────────────────────────
export function SectionHead({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        marginBottom: 10,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ width: 4, height: 14, borderRadius: 2, backgroundColor: palette.accent }} />
        <Text
          style={{
            fontFamily: fonts.sansBold,
            fontSize: 11,
            color: T.muted,
            letterSpacing: 1.2,
            textTransform: 'uppercase',
          }}
        >
          {children}
        </Text>
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
  style?: StyleProp<ViewStyle>;
};

export function Card({ children, padded = true, dark = false, style }: CardProps) {
  return (
    <View
      style={[
        {
          backgroundColor: dark ? palette.primary2 : '#fff',
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: dark ? 'rgba(255,255,255,0.08)' : T.line,
          padding: padded ? 16 : 0,
          overflow: padded ? 'visible' : 'hidden',
        },
        dark ? null : shadow.card,
        style,
      ]}
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
      style={{
        flex: 1,
        padding: 14,
        borderRadius: radius.md,
        backgroundColor: dark ? 'rgba(255,255,255,0.06)' : T.bg2,
        borderWidth: 1,
        borderColor: dark ? 'rgba(255,255,255,0.06)' : T.line2,
        gap: 8,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            backgroundColor: dark ? 'rgba(255,255,255,0.08)' : `${palette.accent}14`,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {icon}
        </View>
        <Text
          numberOfLines={1}
          style={{
            flex: 1,
            fontFamily: fonts.sansBold,
            fontSize: 10,
            letterSpacing: 0.4,
            textTransform: 'uppercase',
            color: dark ? 'rgba(255,255,255,0.6)' : T.muted,
          }}
        >
          {label}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
        <Text style={{ fontFamily: fonts.mono, fontSize: 24, letterSpacing: -0.5, color: dark ? '#fff' : T.ink }}>
          {value}
        </Text>
        {unit ? (
          <Text style={{ fontFamily: fonts.sans, fontSize: 12, color: dark ? 'rgba(255,255,255,0.6)' : T.muted }}>
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
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        height: 22,
        paddingHorizontal: 8,
        borderRadius: 4,
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
      }}
    >
      <Text style={{ fontFamily: fonts.monoMed, fontSize: 11, color: 'rgba(255,255,255,0.7)', letterSpacing: 1 }}>
        {children}
      </Text>
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
    <Svg
      width={width}
      height={height}
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
    >
      {Array.from({ length: vLines }).map((_, i) => (
        <Line key={`v${i}`} x1={i * gap} y1={0} x2={i * gap} y2={height} stroke={stroke} strokeWidth={1} />
      ))}
      {Array.from({ length: hLines }).map((_, i) => (
        <Line key={`h${i}`} x1={0} y1={i * gap} x2={width} y2={i * gap} stroke={stroke} strokeWidth={1} />
      ))}
    </Svg>
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
      style={({ pressed }) => [
        {
          width: size,
          height: size,
          borderRadius: 12,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: filled ? palette.primary : dark ? 'rgba(255,255,255,0.12)' : '#fff',
          borderWidth: dark || filled ? 0 : 1.5,
          borderColor: T.line,
          opacity: pressed ? 0.7 : 1,
        },
        filled ? shadow.primary : null,
      ]}
    >
      {icon}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  inputBox: {
    height: 52,
    borderRadius: radius.md,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: T.line,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 8,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(10,18,38,0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingVertical: 12,
    maxHeight: 420,
  },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 15,
  },
});
