// Registro — nombre, cédula (prefix V-), correo, teléfono, contraseña + términos
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Box, Col, Row, Scroll, Touchable, Txt, useAppColors } from '../ui';
import { Btn, Field, IconBtn, Input } from '../components/primitives';
import { Icon } from '../components/Icon';
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
  const [accepted, setAccepted] = useState(true);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Scroll
        contentContainerStyle={{
          paddingTop: insets.top + 12,
          paddingBottom: Math.max(insets.bottom, 24) + 12,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <Box px="$xl">
          <IconBtn icon={<Icon name="chevL" color={c.ink} size={20} />} onPress={() => navigation.goBack()} />
        </Box>

        <Col px="$2xl" pt="$2xl">
          <Txt font="display" fos={28} ls={-0.6}>
            Crea tu cuenta
          </Txt>
          <Txt fos={14} tone="muted" mt={6}>
            Llena tus datos para registrar tus vehículos.
          </Txt>
        </Col>

        <Col gap="$md" px="$2xl" py="$xl">
          <Field label="Nombre completo">
            <Input value={fullName} onChangeText={setFullName} placeholder="Luis Guerrero" />
          </Field>
          <Field label="Cédula">
            <Input value={cedula} onChangeText={setCedula} placeholder="25.481.073" mono prefix="V-" keyboardType="number-pad" />
          </Field>
          <Field label="Correo electrónico">
            <Input value={email} onChangeText={setEmail} placeholder="tu@correo.com" keyboardType="email-address" autoCapitalize="none" />
          </Field>
          <Field label="Teléfono">
            <Input value={phone} onChangeText={setPhone} placeholder="+58 414 528 9012" mono keyboardType="phone-pad" />
          </Field>
          <Field label="Contraseña" hint="Al menos 8 caracteres">
            <Input
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPass}
              right={
                <Touchable onPress={() => setShowPass((v) => !v)} hitSlop={8} fade>
                  <Icon name={showPass ? 'eyeOff' : 'eye'} color={c.muted} size={20} />
                </Touchable>
              }
            />
          </Field>

          {/* checkbox términos */}
          <Row mt={4} ai="flex-start" gap={10}>
            <Touchable
              onPress={() => setAccepted((v) => !v)}
              transition="quick"
              h={22}
              w={22}
              ai="center"
              jc="center"
              br={6}
              bg={accepted ? '$solid' : '$surface'}
              bw={accepted ? 0 : 1.5}
              bc="$line"
            >
              {accepted ? <Icon name="check" color="#fff" size={14} /> : null}
            </Touchable>
            <Txt f={1} fos={12} lh={18} tone="muted">
              Acepto los <Txt font="semi" fos={12} tone="accent">Términos</Txt> y la{' '}
              <Txt font="semi" fos={12} tone="accent">Política de Privacidad</Txt>.
            </Txt>
          </Row>

          <Btn kind="primary" size="lg" style={{ marginTop: 6 }} onPress={() => navigation.replace('Tabs')}>
            Crear cuenta
          </Btn>
        </Col>
      </Scroll>
    </KeyboardAvoidingView>
  );
}
