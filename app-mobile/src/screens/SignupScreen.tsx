// Registro — nombre, cédula (prefix V-), correo, teléfono, contraseña + términos
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import clsx from 'clsx';
import { Pressable, ScrollView, Text, View } from '../tw';
import { T } from '../theme';
import { Btn, Field, IconBtn, Input } from '../components/primitives';
import { Icon } from '../components/Icon';
import { RootScreenProps } from '../navigation/types';

export function SignupScreen({ navigation }: RootScreenProps<'Signup'>) {
  const insets = useSafeAreaInsets();
  const [fullName, setFullName] = useState('');
  const [cedula, setCedula] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [accepted, setAccepted] = useState(true);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        className="flex-1 bg-white"
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: Math.max(insets.bottom, 24) + 12 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="px-5">
          <IconBtn icon={<Icon name="chevL" color={T.ink} size={20} />} onPress={() => navigation.goBack()} />
        </View>

        <View className="px-6 pt-6">
          <Text className="font-display text-[28px] text-ink tracking-[-0.6px]">
            Crea tu cuenta
          </Text>
          <Text className="mt-1.5 font-sans text-[14px] text-muted">
            Llena tus datos para registrar tus vehículos.
          </Text>
        </View>

        <View className="gap-3 px-6 py-5">
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
                <Pressable onPress={() => setShowPass((v) => !v)} hitSlop={8}>
                  <Icon name={showPass ? 'eyeOff' : 'eye'} color={T.muted} size={20} />
                </Pressable>
              }
            />
          </Field>

          {/* checkbox términos */}
          <View className="mt-1 flex-row items-start gap-2.5">
            <Pressable
              onPress={() => setAccepted((v) => !v)}
              className={clsx(
                'h-[22px] w-[22px] items-center justify-center rounded-[6px]',
                accepted ? 'bg-primary' : 'border-[1.5px] border-line bg-white'
              )}
            >
              {accepted ? <Icon name="check" color="#fff" size={14} /> : null}
            </Pressable>
            <Text className="flex-1 font-sans text-[12px] leading-[18px] text-muted">
              Acepto los <Text className="font-sans-semi text-accent">Términos</Text> y la{' '}
              <Text className="font-sans-semi text-accent">Política de Privacidad</Text>.
            </Text>
          </View>

          <Btn kind="primary" size="lg" className="mt-1.5" onPress={() => navigation.replace('Tabs')}>
            Crear cuenta
          </Btn>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
