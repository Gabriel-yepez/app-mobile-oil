// Login — logo + wordmark, 2 campos, sin botones sociales (pedido del cliente)
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts, palette, T } from '../theme';
import { BrandMark } from '../components/BrandMark';
import { Btn, Field, Input } from '../components/primitives';
import { Icon } from '../components/Icon';
import { RootScreenProps } from '../navigation/types';

export function LoginScreen({ navigation }: RootScreenProps<'Login'>) {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('luis.guerrero@gmail.com');
  const [password, setPassword] = useState('contraseña1');
  const [showPass, setShowPass] = useState(false);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={{ flex: 1, backgroundColor: '#fff' }}
        contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + 28 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* logo + wordmark */}
        <View style={{ alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <BrandMark size={42} />
            <Text style={{ fontFamily: fonts.display, fontSize: 22, color: T.ink, letterSpacing: -0.4 }}>
              OilTrack <Text style={{ color: palette.accent }}>VE</Text>
            </Text>
          </View>
        </View>

        <View style={{ paddingHorizontal: 24, paddingTop: 32 }}>
          <Text style={{ fontFamily: fonts.display, fontSize: 28, color: T.ink, letterSpacing: -0.6 }}>
            Bienvenido de nuevo
          </Text>
          <Text style={{ marginTop: 6, color: T.muted, fontFamily: fonts.sans, fontSize: 14 }}>
            Ingresa para ver tus vehículos y próximos cambios.
          </Text>
        </View>

        <View style={{ paddingHorizontal: 24, paddingTop: 24, gap: 14 }}>
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
                <Pressable onPress={() => setShowPass((v) => !v)} hitSlop={8}>
                  <Icon name={showPass ? 'eyeOff' : 'eye'} color={T.muted} size={20} />
                </Pressable>
              }
            />
          </Field>
          <Pressable style={{ alignSelf: 'flex-end' }} hitSlop={8}>
            <Text style={{ fontFamily: fonts.sansSemi, fontSize: 13, color: palette.accent }}>
              ¿Olvidaste tu contraseña?
            </Text>
          </Pressable>
          <Btn kind="primary" size="lg" onPress={() => navigation.replace('Tabs')}>
            Iniciar sesión
          </Btn>
        </View>

        <View style={{ flex: 1 }} />
        <View style={{ paddingBottom: Math.max(insets.bottom, 24) + 12, alignItems: 'center' }}>
          <Text style={{ color: T.muted, fontFamily: fonts.sans, fontSize: 14 }}>
            ¿No tienes cuenta?{' '}
            <Text style={{ color: palette.accent, fontFamily: fonts.sansSemi }} onPress={() => navigation.navigate('Signup')}>
              Crear una
            </Text>
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
