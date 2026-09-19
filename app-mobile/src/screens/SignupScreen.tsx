// Registro — mismo hero navy y misma tarjeta montada que el login, para que
// las dos puertas de entrada se lean como la misma pantalla en dos estados.
//
// Va en TRES pasos porque el perfil necesita ocho campos más los términos, y
// todos juntos era una tarjeta con scroll largo donde no se ve cuánto falta.
// El hero se queda —es lo que hermana esta pantalla con el login— y el
// contador de pasos vive dentro de él, junto al botón de volver.
//
//   01 · Tus datos  — nombre, cédula, teléfono
//   02 · Dónde estás — estado, ciudad, moneda
//   03 · Acceso      — correo, contraseña, términos
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Box, Col, Row, Scroll, Touchable, Txt, useAppColors } from '../ui';
import { AuthHero } from '../components/AuthHero';
import {
  Btn,
  Card,
  Checkbox,
  Field,
  IconBtn,
  Input,
  Select,
} from '../components/primitives';
import { StepBars, StepCounter } from '../components/StepProgress';
import { Icon } from '../components/Icon';
import { useAuth } from '../store/auth';
import { ApiError } from '../api/base';
import { isEmail } from '../utils/validate';
import { RootScreenProps } from '../navigation/types';
import type { ApiUser } from '../api/controllers/auth.controller';

const TOTAL = 3;

// El usuario elige en su idioma; la API recibe el código. Sin este mapa, la
// pantalla mandaría "Ambas" y el backend lo rechazaría.
const MONEDAS: { etiqueta: string; valor: ApiUser['currency'] }[] = [
  { etiqueta: 'Dólares y bolívares', valor: 'BOTH' },
  { etiqueta: 'Solo dólares (USD)', valor: 'USD' },
  { etiqueta: 'Solo bolívares (Bs.)', valor: 'BS' },
];

const COPY: Record<number, { eyebrow: string; title: string; subtitle: string }> = {
  1: {
    eyebrow: 'Registro',
    title: 'Empecemos por ti',
    subtitle: 'Tu nombre y cédula, para identificar la cuenta.',
  },
  2: {
    eyebrow: 'Registro',
    title: '¿Dónde estás?',
    subtitle: 'Nos sirve para los precios y los talleres cercanos.',
  },
  3: {
    eyebrow: 'Registro',
    title: 'Datos de acceso',
    subtitle: 'Con esto entrarás a tu cuenta la próxima vez.',
  },
};

export function SignupScreen({ navigation }: RootScreenProps<'Signup'>) {
  const insets = useSafeAreaInsets();
  const c = useAppColors();

  const [paso, setPaso] = useState(1);

  const [fullName, setFullName] = useState('');
  const [cedula, setCedula] = useState('');
  const [phone, setPhone] = useState('');
  const [state, setState] = useState('');
  const [city, setCity] = useState('');
  const [currency, setCurrency] = useState<ApiUser['currency']>('BOTH');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  // Arranca SIN marcar: darlo por aceptado da por leído algo que el usuario
  // no ha leído.
  const [accepted, setAccepted] = useState(false);

  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signUp = useAuth((s) => s.signUp);

  /**
   * Qué le falta al paso actual, o `null` si está completo.
   *
   * Se valida paso a paso y no todo al final: si el nombre está mal, hay que
   * decirlo en la pantalla del nombre. Enterarse en el paso 3 obliga a
   * retroceder y a buscar cuál de los ocho campos era.
   */
  const faltaEnPaso = (n: number): string | null => {
    if (n === 1) {
      if (fullName.trim().length < 2) return 'Escribe tu nombre completo.';
      if (cedula.replace(/\D/g, '').length < 6) return 'Escribe tu cédula.';
      if (phone.trim().length < 7) return 'Escribe tu teléfono.';
    }
    if (n === 2) {
      if (state.trim().length < 2) return 'Escribe tu estado.';
      if (city.trim().length < 2) return 'Escribe tu ciudad.';
    }
    if (n === 3) {
      if (!isEmail(email)) return 'Escribe un correo válido.';
      if (password.length < 8) return 'La contraseña debe tener al menos 8 caracteres.';
      if (!/(?=.*[A-Za-zÀ-ÿ])(?=.*\d)/.test(password))
        return 'La contraseña debe incluir al menos una letra y un número.';
      if (!accepted) return 'Debes aceptar los términos para continuar.';
    }
    return null;
  };

  const atras = () => {
    setError(null);
    if (paso > 1) setPaso((p) => p - 1);
    else navigation.goBack();
  };

  const adelante = () => {
    const falta = faltaEnPaso(paso);
    if (falta) return setError(falta);
    setError(null);
    setPaso((p) => p + 1);
  };

  const submit = async () => {
    const falta = faltaEnPaso(3);
    if (falta) return setError(falta);

    setError(null);
    setEnviando(true);
    try {
      // El "V-" es el prefijo visual del campo; se envía junto porque el
      // backend normaliza igual "V-25.481.073" que "25481073".
      await signUp({
        fullName,
        cedula: `V-${cedula}`,
        email,
        phone,
        state,
        city,
        currency,
        password,
      });
      navigation.replace('Tabs');
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : 'No pudimos conectar. Revisa tu conexión.',
      );
    } finally {
      setEnviando(false);
    }
  };

  const copy = COPY[paso];
  const ultimo = paso === TOTAL;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Scroll
        bg="$bg3"
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 24) + 12 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <AuthHero
          eyebrow={copy.eyebrow}
          title={copy.title}
          subtitle={copy.subtitle}
          top={
            <Row ai="center" gap={14} f={1}>
              <IconBtn
                onDark
                icon={<Icon name="chevL" color="#FFFFFF" size={20} />}
                onPress={atras}
              />
              <Col f={1} gap={8}>
                <StepCounter step={paso} total={TOTAL} onDark />
                <StepBars step={paso} total={TOTAL} onDark />
              </Col>
            </Row>
          }
        />

        <Box px={20} mt={-34}>
          <Card gap="$md" p={20}>
            {paso === 1 ? (
              <>
                <Field label="Nombre completo">
                  <Input
                    value={fullName}
                    onChangeText={setFullName}
                    placeholder="Luis Guerrero"
                    autoComplete="name"
                  />
                </Field>
                <Field label="Cédula">
                  <Input
                    value={cedula}
                    onChangeText={setCedula}
                    placeholder="25.481.073"
                    mono
                    prefix="V-"
                    keyboardType="number-pad"
                  />
                </Field>
                <Field label="Teléfono">
                  <Input
                    value={phone}
                    onChangeText={setPhone}
                    placeholder="+58 414 528 9012"
                    mono
                    keyboardType="phone-pad"
                    autoComplete="tel"
                  />
                </Field>
              </>
            ) : null}

            {paso === 2 ? (
              <>
                <Field label="Estado">
                  <Input
                    value={state}
                    onChangeText={setState}
                    placeholder="Distrito Capital"
                    autoComplete="postal-address-region"
                  />
                </Field>
                <Field label="Ciudad">
                  <Input
                    value={city}
                    onChangeText={setCity}
                    placeholder="Caracas"
                    autoComplete="postal-address-locality"
                  />
                </Field>
                <Field label="Moneda" hint="Puedes cambiarla después en tu perfil">
                  <Select
                    value={MONEDAS.find((m) => m.valor === currency)?.etiqueta}
                    options={MONEDAS.map((m) => m.etiqueta)}
                    onChange={(etiqueta) =>
                      setCurrency(
                        MONEDAS.find((m) => m.etiqueta === etiqueta)?.valor ?? 'BOTH',
                      )
                    }
                  />
                </Field>
              </>
            ) : null}

            {paso === 3 ? (
              <>
                <Field label="Correo electrónico">
                  <Input
                    value={email}
                    onChangeText={setEmail}
                    placeholder="tu@correo.com"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                  />
                </Field>
                <Field label="Contraseña" hint="Al menos 8 caracteres, con un número">
                  <Input
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPass}
                    autoComplete="new-password"
                    right={
                      <Touchable onPress={() => setShowPass((v) => !v)} hitSlop={8} fade>
                        <Icon name={showPass ? 'eyeOff' : 'eye'} color={c.muted} size={20} />
                      </Touchable>
                    }
                  />
                </Field>

                {/* La casilla va sin `label`: el texto lleva enlaces propios y
                    debe poder tocarse sin marcar los términos. */}
                <Row mt={4} ai="flex-start" gap={10}>
                  <Checkbox checked={accepted} onToggle={() => setAccepted((v) => !v)} />
                  <Txt f={1} fos={12} lh={18} tone="muted">
                    Acepto los{' '}
                    <Txt font="semi" fos={12} tone="accent">
                      Términos
                    </Txt>{' '}
                    y la{' '}
                    <Txt font="semi" fos={12} tone="accent">
                      Política de Privacidad
                    </Txt>
                    .
                  </Txt>
                </Row>
              </>
            ) : null}

            {error ? (
              <Txt fos={13} tone="danger" mt={2}>
                {error}
              </Txt>
            ) : null}

            <Btn
              kind="primary"
              size="lg"
              style={{ marginTop: 6 }}
              iconRight={<Icon name="arrow" color={c.solidInk} size={20} />}
              disabled={enviando || (ultimo && !accepted)}
              onPress={() => (ultimo ? void submit() : adelante())}
            >
              {enviando ? 'Creando…' : ultimo ? 'Crear cuenta' : 'Continuar'}
            </Btn>
          </Card>
        </Box>

        <Col ai="center" pt="$2xl">
          <Txt fos={14} tone="muted">
            ¿Ya tienes cuenta?{' '}
            <Txt
              font="semi"
              fos={14}
              tone="accent"
              onPress={() => navigation.navigate('Login')}
            >
              Inicia sesión
            </Txt>
          </Txt>
        </Col>
      </Scroll>
    </KeyboardAvoidingView>
  );
}
