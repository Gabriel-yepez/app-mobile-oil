// Registro — nombre, cédula (prefix V-), correo, teléfono, contraseña + términos
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts, palette, T } from '../theme';
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
        style={{ flex: 1, backgroundColor: '#fff' }}
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: Math.max(insets.bottom, 24) + 12 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ paddingHorizontal: 20 }}>
          <IconBtn icon={<Icon name="chevL" color={T.ink} size={20} />} onPress={() => navigation.goBack()} />
        </View>

        <View style={{ paddingHorizontal: 24, paddingTop: 24 }}>
          <Text style={{ fontFamily: fonts.display, fontSize: 28, color: T.ink, letterSpacing: -0.6 }}>
            Crea tu cuenta
          </Text>
          <Text style={{ marginTop: 6, color: T.muted, fontFamily: fonts.sans, fontSize: 14 }}>
            Llena tus datos para registrar tus vehículos.
          </Text>
        </View>

        <View style={{ paddingHorizontal: 24, paddingVertical: 20, gap: 12 }}>
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
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 4 }}>
            <Pressable
              onPress={() => setAccepted((v) => !v)}
              style={{
                width: 22,
                height: 22,
                borderRadius: 6,
                backgroundColor: accepted ? palette.primary : '#fff',
                borderWidth: accepted ? 0 : 1.5,
                borderColor: T.line,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {accepted ? <Icon name="check" color="#fff" size={14} /> : null}
            </Pressable>
            <Text style={{ flex: 1, fontFamily: fonts.sans, fontSize: 12, color: T.muted, lineHeight: 18 }}>
              Acepto los <Text style={{ color: palette.accent, fontFamily: fonts.sansSemi }}>Términos</Text> y la{' '}
              <Text style={{ color: palette.accent, fontFamily: fonts.sansSemi }}>Política de Privacidad</Text>.
            </Text>
          </View>

          <Btn kind="primary" size="lg" style={{ marginTop: 6 }} onPress={() => navigation.replace('Tabs')}>
            Crear cuenta
          </Btn>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
