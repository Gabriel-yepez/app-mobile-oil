// Registro — mismo hero navy y misma tarjeta montada que el login, para que
// las dos puertas de entrada se lean como la misma pantalla en dos estados.
// Campos: nombre, cédula (prefijo V-), correo, teléfono, contraseña + términos.
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Box, Col, Row, Scroll, Touchable, Txt, useAppColors } from '../ui';
import { AuthHero } from '../components/AuthHero';
import { Btn, Card, Checkbox, Field, IconBtn, Input } from '../components/primitives';
import { Icon } from '../components/Icon';
import { useAuth } from '../store/auth';
import { ApiError } from '../api/client';
import { isEmail } from '../utils/validate';
import { RootScreenProps } from '../navigation/types';

export function SignupScreen({ navigation }: RootScreenProps<'Signup'>) {
  const insets = useSafeAreaInsets();
  const c = useAppColors();
  const [fullName, setFullName] = useState('');
  const [cedula, setCedula] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  // Arranca SIN marcar: darlo por aceptado da por leído algo que el usuario
  // no ha leído.
  const [accepted, setAccepted] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signUp = useAuth((s) => s.signUp);

  const submit = async () => {
    setError(null);

    if (fullName.trim().length < 2) return setError('Escribe tu nombre completo.');
    if (cedula.replace(/\D/g, '').length < 6) return setError('Escribe tu cédula.');
    if (!isEmail(email)) return setError('Escribe un correo válido.');
    if (phone.trim().length < 7) return setError('Escribe tu teléfono.');
    if (password.length < 8)
      return setError('La contraseña debe tener al menos 8 caracteres.');

    setEnviando(true);
    try {
      // El "V-" es el prefijo visual del campo; se envía junto porque el
      // backend normaliza igual "V-25.481.073" que "25481073".
      await signUp({ fullName, cedula: `V-${cedula}`, email, phone, password });
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
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 24) + 12 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <AuthHero
          eyebrow="Registro"
          title="Crea tu cuenta"
          subtitle="Llena tus datos para empezar a registrar tus vehículos."
          top={
            <IconBtn
              onDark
              icon={<Icon name="chevL" color="#FFFFFF" size={20} />}
              onPress={() => navigation.goBack()}
            />
          }
        />

        <Box px={20} mt={-34}>
          <Card gap="$md" p={20}>
            <Field label="Nombre completo">
              <Input value={fullName} onChangeText={setFullName} placeholder="Luis Guerrero" autoComplete="name" />
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
            <Field label="Contraseña" hint="Al menos 8 caracteres">
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

            {/* La casilla va sin `label`: el texto lleva enlaces propios y debe
                poder tocarse sin marcar los términos. */}
            <Row mt={4} ai="flex-start" gap={10}>
              <Checkbox checked={accepted} onToggle={() => setAccepted((v) => !v)} />
              <Txt f={1} fos={12} lh={18} tone="muted">
                Acepto los <Txt font="semi" fos={12} tone="accent">Términos</Txt> y la{' '}
                <Txt font="semi" fos={12} tone="accent">Política de Privacidad</Txt>.
              </Txt>
            </Row>

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
              disabled={enviando || !accepted}
              onPress={() => void submit()}
            >
              {enviando ? 'Creando…' : 'Crear cuenta'}
            </Btn>
          </Card>
        </Box>

        <Col ai="center" pt="$2xl">
          <Txt fos={14} tone="muted">
            ¿Ya tienes cuenta?{' '}
            <Txt font="semi" fos={14} tone="accent" onPress={() => navigation.goBack()}>
              Inicia sesión
            </Txt>
          </Txt>
        </Col>
      </Scroll>
    </KeyboardAvoidingView>
  );
}
