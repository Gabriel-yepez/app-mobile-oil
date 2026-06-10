// Login — logo + wordmark, 2 campos, sin botones sociales (pedido del cliente)
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Pressable, ScrollView, Text, View } from '../tw';
import { T } from '../theme';
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
        className="flex-1 bg-white"
        contentContainerClassName="grow"
        contentContainerStyle={{ paddingTop: insets.top + 28 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* logo + wordmark */}
        <View className="items-center">
          <View className="flex-row items-center gap-2.5">
            <BrandMark size={42} />
            <Text className="font-display text-[22px] text-ink tracking-[-0.4px]">
              OilTrack <Text className="text-accent">VE</Text>
            </Text>
          </View>
        </View>

        <View className="px-6 pt-8">
          <Text className="font-display text-[28px] text-ink tracking-[-0.6px]">
            Bienvenido de nuevo
          </Text>
          <Text className="mt-1.5 font-sans text-[14px] text-muted">
            Ingresa para ver tus vehículos y próximos cambios.
          </Text>
        </View>

        <View className="gap-3.5 px-6 pt-6">
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
          <Pressable className="self-end" hitSlop={8}>
            <Text className="font-sans-semi text-[13px] text-accent">
              ¿Olvidaste tu contraseña?
            </Text>
          </Pressable>
          <Btn kind="primary" size="lg" onPress={() => navigation.replace('Tabs')}>
            Iniciar sesión
          </Btn>
        </View>

        <View className="flex-1" />
        <View className="items-center" style={{ paddingBottom: Math.max(insets.bottom, 24) + 12 }}>
          <Text className="font-sans text-[14px] text-muted">
            ¿No tienes cuenta?{' '}
            <Text className="font-sans-semi text-accent" onPress={() => navigation.navigate('Signup')}>
              Crear una
            </Text>
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
