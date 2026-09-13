// Cabecera de las pantallas de acceso (login y registro).
//
// Es el mismo hero navy del Home y del escenario del onboarding: degradado
// primary→primary2 y esquina inferior de 32. Que las tres puertas de entrada
// compartan el gesto es lo que hace que abrir la app se sienta continuo.
//
// Los colores de acá son fijos y no tokens de tema, como en el resto del hero:
// el fondo es navy en claro Y en oscuro, así que un token lo rompería.
import React, { ReactNode, useId } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { Box, Col, Row, Txt, useAppColors } from '../ui';
import { palette } from '../theme';

/** Azul de acento sobre navy. El `accent2` del tema claro (#3B82F6) se apaga
 *  contra el hero; este es el del tema oscuro, que rinde en los dos. */
const ON_NAVY_ACCENT = '#60A5FA';

type Props = {
  /** Fila superior: la marca en login, el botón de volver en registro. */
  top: ReactNode;
  eyebrow: string;
  title: string;
  subtitle: string;
};

export function AuthHero({ top, eyebrow, title, subtitle }: Props) {
  const insets = useSafeAreaInsets();
  const c = useAppColors();
  // Login y registro conviven en el stack, así que el id del degradado tiene
  // que ser único por instancia: react-native-svg los resuelve por nombre y dos
  // <Defs> con el mismo id se pisan.
  const glowId = `authGlow-${useId()}`;

  return (
    <LinearGradient
      colors={[c.primary, c.primary2]}
      style={{
        paddingTop: insets.top + 14,
        paddingHorizontal: 24,
        // Deja sitio para que la tarjeta del formulario monte encima.
        paddingBottom: 58,
        borderBottomLeftRadius: 32,
        borderBottomRightRadius: 32,
        overflow: 'hidden',
      }}
    >
      {/* Resplandor de acento: la misma atmósfera del escenario del onboarding. */}
      <Box pos="absolute" t={-96} r={-72} pointerEvents="none">
        <Svg width={280} height={280} viewBox="0 0 100 100">
          <Defs>
            <RadialGradient id={glowId} cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={palette.accent2} stopOpacity={0.5} />
              <Stop offset="0.6" stopColor={palette.accent2} stopOpacity={0.12} />
              <Stop offset="1" stopColor={palette.accent2} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={50} cy={50} r={50} fill={`url(#${glowId})`} />
        </Svg>
      </Box>

      {top}

      <Col mt="$2xl">
        <Row ai="center" gap={8} mb={10}>
          <Box h={6} w={6} br={3} bg={ON_NAVY_ACCENT} />
          <Txt font="bold" fos={11} ls={2} caps col={ON_NAVY_ACCENT}>
            {eyebrow}
          </Txt>
        </Row>
        <Txt font="display" fos={30} lh={34} ls={-1} tone="onDark">
          {title}
        </Txt>
        <Txt fos={14} lh={21} tone="onDarkSoft" mt={8}>
          {subtitle}
        </Txt>
      </Col>
    </LinearGradient>
  );
}
