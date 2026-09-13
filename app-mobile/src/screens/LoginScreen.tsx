// Login — logo + wordmark, 2 campos, sin botones sociales (pedido del cliente)
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Box, Col, Row, Scroll, Touchable, Txt, useAppColors } from '../ui';
import { BrandMark } from '../components/BrandMark';
import { Btn, Field, Input } from '../components/primitives';
import { Icon } from '../components/Icon';
import { RootScreenProps } from '../navigation/types';

export function LoginScreen({ navigation }: RootScreenProps<'Login'>) {
  const insets = useSafeAreaInsets();
  const c = useAppColors();
  const [email, setEmail] = useState('luis.guerrero@gmail.com');
  const [password, setPassword] = useState('contraseña1');
  const [showPass, setShowPass] = useState(false);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Scroll
        contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + 28 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* logo + wordmark */}
        <Box ai="center">
          <Row gap={10} transition="bouncy" enterStyle={{ opacity: 0, y: -8 }}>
            <BrandMark size={42} />
            <Txt font="display" fos={22} ls={-0.4}>
              OilTrack <Txt font="display" fos={22} tone="accent">VE</Txt>
            </Txt>
          </Row>
        </Box>

        <Col px="$2xl" pt="$3xl">
          <Txt font="display" fos={28} ls={-0.6}>
            Bienvenido de nuevo
          </Txt>
          <Txt fos={14} tone="muted" mt={6}>
            Ingresa para ver tus vehículos y próximos cambios.
          </Txt>
        </Col>

        <Col gap={14} px="$2xl" pt="$2xl">
          <Field label="Correo electrónico">
            <Input
              value={email}
              onChangeText={setEmail}
              placeholder="tu@correo.com"
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </Field>
          <Field label="Contraseña">
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
          <Touchable als="flex-end" hitSlop={8} fade>
            <Txt font="semi" fos={13} tone="accent">
              ¿Olvidaste tu contraseña?
            </Txt>
          </Touchable>
          <Btn kind="primary" size="lg" onPress={() => navigation.replace('Tabs')}>
            Iniciar sesión
          </Btn>
        </Col>

        <Box f={1} />
        <Box ai="center" pb={Math.max(insets.bottom, 24) + 12}>
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
