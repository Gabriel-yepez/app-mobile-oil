// Primitivas — botones, inputs, cards, pills, KPI. Migradas del handoff.
//
// Todo el color sale de tokens de tema, así que cada componente sirve en claro
// y oscuro sin ramificar. La excepción es el prop `onDark`: marca los elementos
// que viven sobre el hero navy, que es oscuro en AMBOS temas.
// (Antes este prop se llamaba `dark`, lo que se confundía con el modo oscuro.)
import React, { ReactNode, useState } from 'react';
import { FlatList, Modal, ScrollView, StyleProp, TextInputProps, ViewStyle } from 'react-native';

import { LinearGradient } from 'expo-linear-gradient';
import { Box, Col, NativeInput, Row, Touchable, Txt, useAppColors, useColorScheme, useShadows } from '../ui';
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
  /** Igual que `icon`, pero después del texto: flechas de avance, chevrons. */
  iconRight?: ReactNode;
  /** Apagado y sin respuesta: falta algo por llenar. */
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  textColor?: string;
  onPress?: () => void;
};

export function Btn({ children, kind = 'primary', size = 'md', icon, iconRight, disabled = false, style, textColor, onPress }: BtnProps) {
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
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      opacity={disabled ? 0.45 : 1}
      fade={!disabled}
      sink={!disabled}
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
      {iconRight}
    </Touchable>
  );
}

// ────────────────────────────────────────────
// Field (label + hint)
// ────────────────────────────────────────────
type FieldProps = {
  label?: string;
  hint?: string;
  /** Reemplaza al `hint` mientras el campo esté mal: mismo sitio, tono peligro. */
  error?: string;
  suffix?: string;
  children: ReactNode;
};

export function Field({ label, hint, error, suffix, children }: FieldProps) {
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
      {error ? (
        <Txt font="semi" fos={12} tone="danger">{error}</Txt>
      ) : hint ? (
        <Txt fos={12} tone="muted2">{hint}</Txt>
      ) : null}
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
  /** Pinta el borde en rojo. El mensaje lo pone el `error` del Field. */
  invalid?: boolean;
} & TextInputProps;

export function Input({ mono = false, prefix, right, invalid = false, style, ...rest }: InputProps) {
  const [focused, setFocused] = useState(false);
  const c = useAppColors();
  const esquema = useColorScheme();

  return (
    <Row
      h={52}
      gap="$sm"
      br="$md"
      bw={1.5}
      px={14}
      bg="$surface"
      bc={invalid ? '$danger' : focused ? '$accent' : '$line'}
      transition="quick"
    >
      {prefix ? (
        <Txt font={mono ? 'monoMed' : 'sans'} fos={14} tone="muted">
          {prefix}
        </Txt>
      ) : null}
      {/* El override de apariencia de la ventana ya debería arrastrar al
          teclado, pero iOS no siempre lo respeta con el valor 'default'.
          Decirlo explícito no cuesta nada y lo deja fuera de duda. Va antes
          de `...rest` para que una pantalla pueda pisarlo si lo necesita. */}
      <NativeInput
        keyboardAppearance={esquema}
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
// Checkbox
// ────────────────────────────────────────────
// Con `label` toda la fila es el área táctil, que es lo cómodo para un
// "Recordarme". Sin `label` solo se pinta la casilla: es lo que necesita el
// bloque de términos, donde el texto lleva enlaces propios que deben poder
// tocarse sin marcar la casilla.
type CheckboxProps = {
  checked: boolean;
  onToggle: () => void;
  label?: string;
  size?: number;
};

export function Checkbox({ checked, onToggle, label, size = 22 }: CheckboxProps) {
  const c = useAppColors();

  const box = (
    <Box
      transition="quick"
      h={size}
      w={size}
      ai="center"
      jc="center"
      br={6}
      bg={checked ? '$solid' : '$surface'}
      bw={checked ? 0 : 1.5}
      bc="$line"
    >
      {checked ? <Icon name="check" color={c.solidInk} size={Math.round(size * 0.64)} /> : null}
    </Box>
  );

  if (!label) {
    return (
      <Touchable onPress={onToggle} hitSlop={8}>
        {box}
      </Touchable>
    );
  }

  return (
    <Touchable onPress={onToggle} fd="row" ai="center" gap={10} hitSlop={8}>
      {box}
      <Txt font="semi" fos={13} tone="ink2">
        {label}
      </Txt>
    </Touchable>
  );
}

// ────────────────────────────────────────────
// CodeInput — código de un solo uso, una casilla por dígito
// ────────────────────────────────────────────
// Las casillas son SOLO pintura: debajo hay un único TextInput invisible que
// las cubre por completo. Seis inputs de verdad (uno por casilla) obligarían a
// mover el foco a mano en cada tecla y romperían pegar el código de un tirón y
// el autorrelleno del sistema, que llegan como una sola cadena de 6 caracteres.
type CodeInputProps = {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  autoFocus?: boolean;
};

export function CodeInput({ value, onChange, length = 6, autoFocus = false }: CodeInputProps) {
  const esquema = useColorScheme();
  const [focused, setFocused] = useState(false);
  const digits = value.split('');

  return (
    <Box>
      <Row gap={8}>
        {Array.from({ length }).map((_, i) => {
          const char = digits[i];
          // La casilla activa es donde caerá el próximo dígito; con el código
          // completo se queda marcada la última, que es la que se va a borrar.
          const active = focused && (value.length === length ? i === length - 1 : i === value.length);
          return (
            <Box
              key={i}
              f={1}
              h={58}
              ai="center"
              jc="center"
              br="$md"
              bw={1.5}
              transition="quick"
              bg={char ? '$bg2' : '$surface'}
              bc={active ? '$accent' : '$line'}
            >
              <Txt font="mono" fos={22} ls={0} tone="ink">
                {char ?? ''}
              </Txt>
            </Box>
          );
        })}
      </Row>

      <NativeInput
        pos="absolute"
        t={0}
        l={0}
        r={0}
        b={0}
        opacity={0}
        keyboardAppearance={esquema}
        value={value}
        // El teclado numérico de iOS no impide pegar texto, así que el filtro
        // no es decorativo: sin él, pegar "Código: 123456" rompe las casillas.
        onChangeText={(t) => onChange(t.replace(/\D/g, '').slice(0, length))}
        keyboardType="number-pad"
        // Autorrelleno del código: `oneTimeCode` en iOS, `sms-otp` en Android.
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        maxLength={length}
        caretHidden
        autoFocus={autoFocus}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
    </Box>
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
  /** Campo de búsqueda arriba de la lista. Para catálogos que crecen. */
  searchable?: boolean;
  /**
   * Habilita la fila "+ Agregar «X»" al final, cuando lo escrito no calza
   * exacto con ninguna opción. `Select` NO sabe qué es lo que se agrega: la
   * pantalla que lo usa decide qué hacer con el texto.
   */
  onAddNew?: (texto: string) => void;
};

export function Select({
  value,
  placeholder = 'Seleccionar',
  options,
  onChange,
  searchable = false,
  onAddNew,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const c = useAppColors();

  const escrito = busqueda.trim();
  const enMinuscula = escrito.toLocaleLowerCase('es');

  const visibles = escrito
    ? options.filter((o) => o.toLocaleLowerCase('es').includes(enMinuscula))
    : options;

  // Solo se ofrece agregar si lo escrito no es ya una opción. La comparación
  // es laxa (sin mayúsculas ni espacios de más) para no ofrecer "Agregar
  // «toyota»" cuando Toyota está tres filas más arriba.
  const yaExiste = options.some(
    (o) => o.trim().toLocaleLowerCase('es') === enMinuscula,
  );
  const puedeAgregar = Boolean(onAddNew) && escrito.length > 0 && !yaExiste;

  const cerrar = () => {
    setBusqueda('');
    setOpen(false);
  };

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

      <Modal visible={open} transparent animationType="fade" onRequestClose={cerrar}>
        <Touchable f={1} jc="flex-end" bg="$scrim" onPress={cerrar}>
          {/* La hoja se traga sus propios toques. Sin esto, tocar el campo de
              búsqueda CIERRA la hoja en vez de enfocarlo: el toque atraviesa
              el Input —que no es un Touchable— y termina en el fondo, que
              cierra. Las filas de la lista nunca lo sufrieron porque cada una
              es su propio Touchable y se queda con el toque. */}
          <Touchable
            onPress={() => {}}
            maxHeight={420}
            borderTopLeftRadius="$xl"
            borderTopRightRadius="$xl"
            bg="$surface"
            py="$md"
            transition="bouncy"
            enterStyle={{ y: 40, opacity: 0 }}
          >
            {searchable ? (
              <Box px="$2xl" pb="$sm">
                <Input
                  value={busqueda}
                  onChangeText={setBusqueda}
                  placeholder="Buscar"
                  autoCapitalize="words"
                />
              </Box>
            ) : null}

            <FlatList
              data={visibles}
              keyExtractor={(o) => o}
              keyboardShouldPersistTaps="handled"
              ListFooterComponent={
                puedeAgregar ? (
                  <Touchable
                    fd="row"
                    ai="center"
                    gap="$sm"
                    px="$2xl"
                    py={15}
                    pressStyle={{ bg: '$bg2' }}
                    onPress={() => {
                      onAddNew?.(escrito);
                      cerrar();
                    }}
                  >
                    <Icon name="plus" color={c.accent} size={18} />
                    <Txt f={1} fos={15} font="semi" tone="accent">
                      Agregar «{escrito}»
                    </Txt>
                  </Touchable>
                ) : null
              }
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
                      cerrar();
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
          </Touchable>
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
      <Txt font="bold" fos={11} tone="muted" ls={1.2} caps>
        {children}
      </Txt>
      {right}
    </Row>
  );
}

// ────────────────────────────────────────────
// FilterChips
// ────────────────────────────────────────────
// Fila de chips con contador. La usan el Garaje y el Historial: el patrón ya
// estaba escrito a mano en el Garaje, y copiarlo al Historial habría dejado dos
// versiones que se despegan a la primera corrección de estilo.
//
// Genérico en el id para que cada pantalla filtre con su propia unión de
// literales y no con `string`: así un chip mal escrito no compila.
export type FilterChip<T extends string> = { id: T; label: string; n: number };

export function FilterChips<T extends string>({
  chips,
  value,
  onChange,
  scrollable = false,
  px = 0,
}: {
  chips: FilterChip<T>[];
  value: T;
  onChange: (id: T) => void;
  /** Para listas que crecen con los datos: sin esto, a partir de cuatro o cinco
   *  chips los últimos quedan fuera de la pantalla y no hay forma de llegar. */
  scrollable?: boolean;
  /** Sangría horizontal. Va acá y no en un contenedor de afuera porque con
   *  scroll tiene que ser padding del contenido: en el contenedor recortaría
   *  los chips de los extremos al desplazarse. */
  px?: number;
}) {
  const fila = (
    <Row gap="$sm" px={px}>
      {chips.map((chip) => {
        const isActive = value === chip.id;
        return (
          <Touchable
            key={chip.id}
            onPress={() => onChange(chip.id)}
            fade
            transition="quick"
            fd="row"
            ai="center"
            h={34}
            gap={6}
            br="$pill"
            px={14}
            bg={isActive ? '$solid' : '$surface'}
            bw={isActive ? 0 : 1}
            bc="$line"
          >
            <Txt font="semi" fos={13} tone={isActive ? 'onSolid' : 'ink'}>
              {chip.label}
            </Txt>
            <Box br={6} px={6} py={1} bg={isActive ? 'rgba(255,255,255,0.18)' : '$bg2'}>
              <Txt font="monoMed" fos={10} tone={isActive ? 'onSolid' : 'muted'}>
                {chip.n}
              </Txt>
            </Box>
          </Touchable>
        );
      })}
    </Row>
  );

  if (!scrollable) return fila;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      {fila}
    </ScrollView>
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
      bg={onDark ? 'rgba(255,255,255,0.06)' : '$surface'}
      bc={onDark ? 'rgba(255,255,255,0.06)' : '$line'}
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
