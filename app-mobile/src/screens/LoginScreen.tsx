// Login — hero navy (el mismo del Home y del onboarding) con la tarjeta del
// formulario montada encima. Sin botones sociales: pedido del cliente.
//
// "Recordarme" guarda el CORREO en el store de sesión, nunca la contraseña.
import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Box, Row, Scroll, Touchable, Txt, useAppColors } from '../ui';
import { BrandMark } from '../components/BrandMark';
import { AuthHero } from '../components/AuthHero';
import { Btn, Card, Checkbox, Field, Input } from '../components/primitives';
import { Icon } from '../components/Icon';
import { useSession } from '../store/session';
import { useAuth } from '../store/auth';
import { ApiError } from '../api/base';
import { isEmail } from '../utils/validate';
import { RootScreenProps } from '../navigation/types';

export function LoginScreen({ navigation }: RootScreenProps<'Login'>) {
  const insets = useSafeAreaInsets();
  const c = useAppColors();

  const hydrated = useSession((s) => s.hydrated);
  const savedEmail = useSession((s) => s.email);
  const savedRemember = useSession((s) => s.remember);
  const rememberEmail = useSession((s) => s.rememberEmail);
  const forget = useSession((s) => s.forget);

  const signIn = useAuth((s) => s.signIn);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [remember, setRemember] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // El almacenamiento se lee en asíncrono: hasta que no termina no hay correo
  // guardado que poner.
  useEffect(() => {
    if (!hydrated) return;
    setRemember(savedRemember);
    if (savedRemember && savedEmail) setEmail(savedEmail);
  }, [hydrated, savedRemember, savedEmail]);

  const submit = async () => {
    setError(null);

    // Se atajan acá los errores obvios para no gastar una petición; decidir si
    // la cuenta existe sigue siendo cosa del servidor.
    if (!isEmail(email)) return setError('Escribe un correo válido.');
    if (password.length === 0) return setError('Escribe tu contraseña.');

    setEnviando(true);
    try {
      await signIn(email, password);
      // "Recordarme" guarda el correo, nunca la contraseña. Se hace después de
      // entrar: recordar un correo con el que no se pudo acceder no sirve.
      if (remember) rememberEmail(email);
      else forget();
      navigation.replace('Tabs');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No pudimos conectar. Revisa tu conexión.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Scroll
        bg="$bg3"
        contentContainerStyle={{ flexGrow: 1, paddingBottom: Math.max(insets.bottom, 24) + 12 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <AuthHero
          eyebrow="Acceso"
          title="Bienvenido de nuevo"
          subtitle="Ingresa para ver tus vehículos y sus próximos cambios."
          top={
            <Row gap={12} ai="center" transition="bouncy" enterStyle={{ opacity: 0, y: -8 }}>
              {/* La marca es un degradado accent→primary: sobre el navy su
                  mitad inferior se perdería, así que va sobre una pastilla
                  translúcida, como los botones del header del Home. */}
              <Box h={48} w={48} br={14} ai="center" jc="center" bg="rgba(255,255,255,0.12)">
                <BrandMark size={30} />
              </Box>
              <Txt font="display" fos={21} ls={-0.4} tone="onDark">
                Ruédalo
              </Txt>
            </Row>
          }
        />

        {/* La tarjeta monta sobre el hero: el mismo recurso de profundidad que
            usan las tarjetas del Home sobre el fondo. */}
        <Box px={20} mt={-34}>
          <Card gap={14} p={20}>
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

            <Field label="Contraseña">
              <Input
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPass}
                autoComplete="password"
                right={
                  <Touchable onPress={() => setShowPass((v) => !v)} hitSlop={8} fade>
                    <Icon name={showPass ? 'eyeOff' : 'eye'} color={c.muted} size={20} />
                  </Touchable>
                }
              />
            </Field>

            <Row jc="space-between" ai="center" gap="$sm" mt={2}>
              <Checkbox checked={remember} onToggle={() => setRemember((v) => !v)} label="Recordarme" />
              <Touchable
                hitSlop={8}
                fade
                onPress={() => navigation.navigate('ForgotPassword', { email })}
              >
                <Txt font="semi" fos={13} tone="accent">
                  ¿Olvidaste tu contraseña?
                </Txt>
              </Touchable>
            </Row>

            {error ? (
              <Txt fos={13} tone="danger" mt={2}>
                {error}
              </Txt>
            ) : null}

            <Btn
              kind="primary"
              size="lg"
              style={{ marginTop: 4 }}
              iconRight={<Icon name="arrow" color={c.solidInk} size={20} />}
              disabled={enviando}
              onPress={() => void submit()}
            >
              {enviando ? 'Entrando…' : 'Iniciar sesión'}
            </Btn>
          </Card>
        </Box>

        <Box f={1} />

        <Box ai="center" pt="$2xl">
          <Txt fos={14} tone="muted">
            ¿No tienes cuenta?{' '}
            <Txt font="semi" fos={14} tone="accent" onPress={() => navigation.navigate('Signup')}>
              Crear una
            </Txt>
          </Txt>
        </Box>
      </Scroll>
    </KeyboardAvoidingView>
  );
}
