// Editar perfil — el destino del botón de lápiz del hero de Perfil.
//
// El formulario arranca como copia local del perfil y solo escribe al store al
// guardar: si el usuario se arrepiente y vuelve, no queda nada a medio cambiar.
// Y guarda únicamente los campos que tocó (`updateProfile` es parcial), así
// mañana sumar un campo al perfil no obliga a pasar por acá.
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Box, Col, Row, Screen, Scroll, Txt, useAppColors } from '../ui';
import { Btn, Field, IconBtn, Input, SectionHead, Select } from '../components/primitives';
import { Icon } from '../components/Icon';
import { Profile } from '../data/mock';
import { useStore } from '../store/useStore';

/** Los 24 estados de Venezuela, para no dejar el estado como texto libre —
 *  escrito a mano es la vía rápida a "Miranda", "miranda" y "Mirandq". */
const ESTADOS = [
  'Amazonas', 'Anzoátegui', 'Apure', 'Aragua', 'Barinas', 'Bolívar', 'Carabobo',
  'Cojedes', 'Delta Amacuro', 'Distrito Capital', 'Falcón', 'Guárico', 'La Guaira',
  'Lara', 'Mérida', 'Miranda', 'Monagas', 'Nueva Esparta', 'Portuguesa', 'Sucre',
  'Táchira', 'Trujillo', 'Yaracuy', 'Zulia',
];

/** Campos editables. La cédula queda afuera a propósito: identifica la cuenta y
 *  cambiarla es un trámite de verificación, no una edición de perfil. */
type Editable = Pick<Profile, 'fullName' | 'email' | 'phone' | 'state' | 'city'>;

const vacio = (s: string) => s.trim().length === 0;

export function EditProfileScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const c = useAppColors();
  const profile = useStore((s) => s.profile);
  const updateProfile = useStore((s) => s.updateProfile);

  const [form, setForm] = useState<Editable>({
    fullName: profile.fullName,
    email: profile.email,
    phone: profile.phone,
    state: profile.state,
    city: profile.city,
  });
  // Los errores aparecen recién al intentar guardar: marcar en rojo un campo
  // que el usuario todavía no terminó de escribir es hostil.
  const [intento, setIntento] = useState(false);

  const set = <K extends keyof Editable>(k: K, v: Editable[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const errores = {
    fullName: vacio(form.fullName) ? 'Poné tu nombre y apellido' : '',
    email: vacio(form.email)
      ? 'Poné tu correo'
      : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())
        ? 'Ese correo no parece válido'
        : '',
    city: vacio(form.city) ? 'Poné tu ciudad' : '',
  };
  const hayError = Object.values(errores).some(Boolean);

  const guardar = () => {
    setIntento(true);
    if (hayError) return;
    updateProfile({
      fullName: form.fullName.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      state: form.state,
      city: form.city.trim(),
    });
    navigation.goBack();
  };

  const err = (k: keyof typeof errores) => (intento ? errores[k] : '');

  return (
    <Screen>
      <Row jc="space-between" ai="center" px="$lg" pb="$md" style={{ paddingTop: insets.top + 12 }}>
        <IconBtn
          icon={<Icon name="chevL" color={c.ink} size={20} />}
          onPress={() => navigation.goBack()}
        />
        <Txt font="display" fos={18}>
          Editar perfil
        </Txt>
        <Box w={36} />
      </Row>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Scroll
          contentContainerStyle={{ paddingBottom: 32, gap: 18 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Col gap="$sm">
            <SectionHead>Datos personales</SectionHead>
            <Col px="$lg" gap="$lg">
              <Field label="Nombre y apellido" error={err('fullName')}>
                <Input
                  value={form.fullName}
                  onChangeText={(v) => set('fullName', v)}
                  placeholder="Luis Guerrero"
                  autoCapitalize="words"
                  invalid={!!err('fullName')}
                />
              </Field>

              {/* La cédula se muestra pero no se edita: es el identificador de
                  la cuenta. Se ve para que el usuario confirme que es la suya. */}
              <Field label="Cédula" hint="Para cambiarla, escribí a soporte">
                <Input value={profile.cedula} editable={false} mono />
              </Field>

              <Field label="Correo" error={err('email')}>
                <Input
                  value={form.email}
                  onChangeText={(v) => set('email', v)}
                  placeholder="tu@correo.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  invalid={!!err('email')}
                />
              </Field>

              <Field label="Teléfono">
                <Input
                  value={form.phone}
                  onChangeText={(v) => set('phone', v)}
                  placeholder="+58 414 000 0000"
                  keyboardType="phone-pad"
                  mono
                />
              </Field>
            </Col>
          </Col>

          <Col gap="$sm">
            <SectionHead>Ubicación</SectionHead>
            <Col px="$lg" gap="$lg">
              <Field label="Estado">
                <Select
                  value={form.state}
                  options={ESTADOS}
                  onChange={(v) => set('state', v)}
                />
              </Field>

              <Field label="Ciudad" error={err('city')}>
                <Input
                  value={form.city}
                  onChangeText={(v) => set('city', v)}
                  placeholder="Caracas"
                  autoCapitalize="words"
                  invalid={!!err('city')}
                />
              </Field>
            </Col>
          </Col>

          <Box px="$lg" pt="$sm">
            <Btn size="lg" onPress={guardar}>
              Guardar cambios
            </Btn>
          </Box>
        </Scroll>
      </KeyboardAvoidingView>
    </Screen>
  );
}
