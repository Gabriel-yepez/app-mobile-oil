// Recuperar contraseña — mismo hero navy y misma tarjeta montada que login y
// registro, y el mismo contador de pasos sobre el navy que el registro.
//
//   01 · Correo      — pedir el código
//   02 · Código      — los 6 dígitos que llegaron por correo
//   03 · Contraseña  — la nueva y su confirmación, con la leyenda de reglas
//
// Se llega desde el login ("¿Olvidaste tu contraseña?") y desde Seguridad
// ("Cambiar contraseña"), con el correo ya puesto en los dos casos.
//
// Al terminar, el servidor cierra TODAS las sesiones de la cuenta. Por eso,
// si se llegó con sesión abierta, también se cierra la local y se vuelve al
// login: quedarse dentro con un token que el servidor ya revocó terminaría en
// un 401 a la primera petición.
import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Box, Col, Row, Scroll, Touchable, Txt, useAppColors } from '../ui';
import { AuthHero } from '../components/AuthHero';
import { Btn, Card, CodeInput, Field, IconBtn, Input } from '../components/primitives';
import { StepBars, StepCounter } from '../components/StepProgress';
import { PasswordRules } from '../components/PasswordRules';
import { Icon } from '../components/Icon';
import { ApiError } from '../api/base';
import { passwordController } from '../api/controllers/password.controller';
import { useAuth } from '../store/auth';
import { isEmail } from '../utils/validate';
import { contrasenaValida } from '../utils/password';
import { textoDeError } from '../utils/errores';
import { RootScreenProps } from '../navigation/types';

const TOTAL = 3;
/** Segundos de espera antes de poder pedir otro código. */
const RESEND_COOLDOWN = 30;
/** Dígitos del código de un solo uso. */
const CODE_LENGTH = 6;

const COPY: Record<number, { title: string; subtitle: string }> = {
  1: {
    title: '¿Olvidaste tu contraseña?',
    subtitle: 'Escribe tu correo y te enviamos un código para crear una nueva.',
  },
  2: {
    title: 'Revisa tu correo',
    subtitle: 'Escribe el código que te enviamos. Puede tardar un par de minutos.',
  },
  3: {
    title: 'Contraseña nueva',
    subtitle: 'Al guardarla se cerrará la sesión en todos tus dispositivos.',
  },
};

export function ForgotPasswordScreen({ navigation, route }: RootScreenProps<'ForgotPassword'>) {
  const insets = useSafeAreaInsets();
  const c = useAppColors();
  const conSesion = useAuth((s) => s.status === 'authed');
  const signOut = useAuth((s) => s.signOut);

  const [paso, setPaso] = useState(1);
  // El login y Seguridad pasan el correo: nadie debería teclearlo dos veces
  // seguidas para recuperar la clave.
  const [email, setEmail] = useState(route.params?.email ?? '');
  const [code, setCode] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPass, setShowPass] = useState(false);

  const [cooldown, setCooldown] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const pedirCodigo = async () => {
    if (!isEmail(email)) {
      setError('Escribe un correo válido, como tu@correo.com.');
      return;
    }
    setError(null);
    setEnviando(true);
    try {
      // El servidor responde igual exista o no la cuenta (para no delatarla),
      // así que acá no hay "ese correo no está registrado" que mostrar.
      await passwordController.forgot(email.trim());
      setCode('');
      setCooldown(RESEND_COOLDOWN);
      setPaso(2);
    } catch (e) {
      setError(textoDeError(e));
    } finally {
      setEnviando(false);
    }
  };

  const verificar = async () => {
    setError(null);
    setEnviando(true);
    try {
      const r = await passwordController.verify(email.trim(), code);
      setResetToken(r.resetToken);
      setPaso(3);
    } catch (e) {
      // Código errado: se borra para que el siguiente intento empiece limpio.
      setCode('');
      setError(textoDeError(e));
    } finally {
      setEnviando(false);
    }
  };

  const coinciden = password === confirm;
  const listo = contrasenaValida(password) && coinciden;

  const guardar = async () => {
    if (!listo) return;
    setError(null);
    setEnviando(true);
    try {
      await passwordController.reset(resetToken, password, confirm);

      // El servidor ya revocó todas las sesiones: si había una abierta acá, se
      // cierra también, o la próxima petición fallaría con 401.
      if (conSesion) await signOut();

      navigation.reset({
        index: 0,
        routes: [
          {
            name: 'Login',
            params: {
              email: email.trim(),
              aviso: 'Tu contraseña cambió. Entra con la nueva.',
            },
          },
        ],
      });
    } catch (e) {
      // El token venció (10 minutos) o ya se usó: no hay nada que reintentar
      // en este paso, hay que pedir un código nuevo.
      if (e instanceof ApiError && e.code === 'INVALID_RESET_TOKEN') {
        setResetToken('');
        setPassword('');
        setConfirm('');
        setPaso(1);
      }
      setError(textoDeError(e));
    } finally {
      setEnviando(false);
    }
  };

  const atras = () => {
    setError(null);
    if (paso > 1) setPaso((p) => p - 1);
    else navigation.goBack();
  };

  const copy = COPY[paso];

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Scroll
        bg="$bg3"
        contentContainerStyle={{
          flexGrow: 1,
          paddingBottom: Math.max(insets.bottom, 24) + 12,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <AuthHero
          eyebrow="Recuperar"
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
          {paso === 1 ? (
            <Card gap={14} p={20}>
              <Field label="Correo electrónico" hint="El que usas para entrar a Ruédalo.">
                <Input
                  value={email}
                  onChangeText={(v) => {
                    setEmail(v);
                    // El error se va al corregir, no al reenviar: mantenerlo
                    // mientras el usuario ya arregla el campo es ruido.
                    if (error) setError(null);
                  }}
                  placeholder="tu@correo.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  autoFocus={!route.params?.email}
                  invalid={!!error}
                  returnKeyType="send"
                  onSubmitEditing={() => void pedirCodigo()}
                />
              </Field>

              {error ? (
                <Txt fos={13} tone="danger">
                  {error}
                </Txt>
              ) : null}

              <Btn
                kind="primary"
                size="lg"
                style={{ marginTop: 4 }}
                disabled={enviando}
                iconRight={<Icon name="arrow" color={c.solidInk} size={20} />}
                onPress={() => void pedirCodigo()}
              >
                {enviando ? 'Enviando…' : 'Enviar código'}
              </Btn>
            </Card>
          ) : null}

          {paso === 2 ? (
            <Card ai="center" gap="$lg" p={24}>
              <Box h={64} w={64} br={20} ai="center" jc="center" bg="$accentSoft">
                <Icon name="mail" color={c.accent} size={30} />
              </Box>

              <Txt fos={14} lh={21} tone="muted" ta="center">
                Escribe los {CODE_LENGTH} dígitos que mandamos a{' '}
                <Txt font="semi" fos={14} tone="ink">
                  {email.trim()}
                </Txt>
                .
              </Txt>

              <Box als="stretch">
                <CodeInput value={code} onChange={setCode} length={CODE_LENGTH} autoFocus />
              </Box>

              {error ? (
                <Txt fos={13} tone="danger" ta="center">
                  {error}
                </Txt>
              ) : null}

              <Btn
                kind="primary"
                size="lg"
                style={{ alignSelf: 'stretch' }}
                disabled={enviando || code.length < CODE_LENGTH}
                iconRight={<Icon name="arrow" color={c.solidInk} size={20} />}
                onPress={() => void verificar()}
              >
                {enviando ? 'Verificando…' : 'Verificar código'}
              </Btn>

              {/* El contador evita el toque nervioso que dispara tres correos
                  seguidos, y de paso dice que algo ya pasó. Pedir otro
                  invalida el anterior. */}
              <Touchable
                onPress={cooldown > 0 || enviando ? undefined : () => void pedirCodigo()}
                hitSlop={8}
                fade
                disabled={cooldown > 0 || enviando}
              >
                <Txt font="semi" fos={13} tone={cooldown > 0 ? 'muted2' : 'accent'}>
                  {cooldown > 0 ? `Reenviar el código en ${cooldown}s` : 'Reenviar el código'}
                </Txt>
              </Touchable>
            </Card>
          ) : null}

          {paso === 3 ? (
            <Card gap="$md" p={20}>
              <Field label="Contraseña nueva">
                <Input
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPass}
                  autoComplete="new-password"
                  autoFocus
                  right={
                    <Touchable onPress={() => setShowPass((v) => !v)} hitSlop={8} fade>
                      <Icon name={showPass ? 'eyeOff' : 'eye'} color={c.muted} size={20} />
                    </Touchable>
                  }
                />
              </Field>
              <PasswordRules password={password} />

              <Field
                label="Confirma la contraseña"
                // Se avisa solo cuando ya escribió algo: un error rojo sobre un
                // campo que ni ha tocado es regañar antes de tiempo.
                error={confirm.length > 0 && !coinciden ? 'Las contraseñas no coinciden' : undefined}
              >
                <Input
                  value={confirm}
                  onChangeText={setConfirm}
                  secureTextEntry={!showPass}
                  autoComplete="new-password"
                  invalid={confirm.length > 0 && !coinciden}
                  returnKeyType="done"
                  onSubmitEditing={() => void guardar()}
                />
              </Field>

              {error ? (
                <Txt fos={13} tone="danger">
                  {error}
                </Txt>
              ) : null}

              <Btn
                kind="primary"
                size="lg"
                style={{ marginTop: 4 }}
                disabled={enviando || !listo}
                iconRight={<Icon name="arrow" color={c.solidInk} size={20} />}
                onPress={() => void guardar()}
              >
                {enviando ? 'Guardando…' : 'Guardar contraseña'}
              </Btn>
            </Card>
          ) : null}
        </Box>

        <Box f={1} />

        <Row jc="center" pt="$2xl">
          <Txt fos={14} tone="muted">
            ¿Ya la recordaste?{' '}
            <Txt font="semi" fos={14} tone="accent" onPress={() => navigation.replace('Login')}>
              Inicia sesión
            </Txt>
          </Txt>
        </Row>
      </Scroll>
    </KeyboardAvoidingView>
  );
}
