// Recuperar contraseña — mismo hero navy y misma tarjeta montada que login y
// registro. Dos pasos en una pantalla: pedir el correo y escribir el código de
// 6 dígitos que llega a ese correo.
//
// Sin backend todavía, ambos pasos son simulados: no sale ningún correo y no
// hay código real contra el cual comparar, así que cualquier combinación de 6
// dígitos pasa. Cuando exista el endpoint, `sent` dependerá de su respuesta,
// `verify` comprobará el código de verdad y su destino será la pantalla de
// contraseña nueva, que todavía no existe.
import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Box, Col, Row, Scroll, Touchable, Txt, useAppColors } from '../ui';
import { AuthHero } from '../components/AuthHero';
import { Btn, Card, CodeInput, Field, IconBtn, Input } from '../components/primitives';
import { Icon } from '../components/Icon';
import { isEmail } from '../utils/validate';
import { RootScreenProps } from '../navigation/types';

/** Segundos de espera antes de poder pedir otro código. */
const RESEND_COOLDOWN = 30;
/** Dígitos del código de un solo uso. */
const CODE_LENGTH = 6;

export function ForgotPasswordScreen({ navigation, route }: RootScreenProps<'ForgotPassword'>) {
  const insets = useSafeAreaInsets();
  const c = useAppColors();

  // El login pasa lo que ya estaba escrito: nadie debería teclear su correo dos
  // veces seguidas para recuperar la clave.
  const [email, setEmail] = useState(route.params?.email ?? '');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const send = () => {
    if (!isEmail(email)) {
      setError('Escribe un correo válido, como tu@correo.com.');
      return;
    }
    setError(null);
    setSent(true);
    setCode('');
    setCooldown(RESEND_COOLDOWN);
  };

  const verify = () => navigation.replace('Login');

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Scroll
        bg="$bg3"
        contentContainerStyle={{ flexGrow: 1, paddingBottom: Math.max(insets.bottom, 24) + 12 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <AuthHero
          eyebrow="Recuperar"
          title={sent ? 'Revisa tu correo' : '¿Olvidaste tu contraseña?'}
          subtitle={
            sent
              ? 'Escribe el código que te enviamos para crear una contraseña nueva. Puede tardar un par de minutos.'
              : 'Escribe tu correo y te enviamos un código para crear una nueva.'
          }
          top={
            <IconBtn
              onDark
              icon={<Icon name="chevL" color="#FFFFFF" size={20} />}
              onPress={() => navigation.goBack()}
            />
          }
        />

        <Box px={20} mt={-34}>
          {sent ? (
            <Card ai="center" gap="$lg" p={24}>
              <Box h={64} w={64} br={20} ai="center" jc="center" bg="$accentSoft">
                <Icon name="mail" color={c.accent} size={30} />
              </Box>

              <Col ai="center" gap={6}>
                <Txt font="display" fos={19} ls={-0.4} ta="center">
                  Código enviado
                </Txt>
                <Txt fos={14} lh={21} tone="muted" ta="center">
                  Escribe los {CODE_LENGTH} dígitos que mandamos a{' '}
                  <Txt font="semi" fos={14} tone="ink">
                    {email.trim()}
                  </Txt>
                  .
                </Txt>
              </Col>

              <Box als="stretch">
                <CodeInput value={code} onChange={setCode} length={CODE_LENGTH} autoFocus />
              </Box>

              <Btn
                kind="primary"
                size="lg"
                style={{ alignSelf: 'stretch' }}
                disabled={code.length < CODE_LENGTH}
                iconRight={<Icon name="arrow" color={c.solidInk} size={20} />}
                onPress={verify}
              >
                Verificar código
              </Btn>

              {/* El contador evita el toque nervioso que dispara tres correos
                  seguidos, y de paso dice que algo ya pasó. */}
              <Touchable onPress={cooldown > 0 ? undefined : send} hitSlop={8} fade disabled={cooldown > 0}>
                <Txt font="semi" fos={13} tone={cooldown > 0 ? 'muted2' : 'accent'}>
                  {cooldown > 0 ? `Reenviar el código en ${cooldown}s` : 'Reenviar el código'}
                </Txt>
              </Touchable>
            </Card>
          ) : (
            <Card gap={14} p={20}>
              <Field
                label="Correo electrónico"
                hint="El que usas para entrar a Ruédalo."
                error={error ?? undefined}
              >
                <Input
                  value={email}
                  onChangeText={(v) => {
                    setEmail(v);
                    // El error se va al corregir, no al reenviar: mantenerlo
                    // mientras el usuario ya está arreglando el campo es ruido.
                    if (error) setError(null);
                  }}
                  placeholder="tu@correo.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  autoFocus={!route.params?.email}
                  invalid={!!error}
                  returnKeyType="send"
                  onSubmitEditing={send}
                />
              </Field>

              <Btn
                kind="primary"
                size="lg"
                style={{ marginTop: 4 }}
                iconRight={<Icon name="arrow" color={c.solidInk} size={20} />}
                onPress={send}
              >
                Enviar código
              </Btn>
            </Card>
          )}
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
