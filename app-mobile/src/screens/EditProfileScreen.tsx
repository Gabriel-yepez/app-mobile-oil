// Editar perfil — el destino del botón de lápiz del hero de Perfil.
//
// El formulario arranca como copia local del perfil y solo se manda al guardar:
// si el usuario se arrepiente y vuelve, no queda nada a medio cambiar.
//
// Guarda contra el BACKEND (PATCH /auth/me) y no contra el store local. El
// store se actualiza solo, con el usuario que devuelve el servidor: así lo que
// queda en pantalla es el valor ya normalizado —"caracas" vuelve como
// "Caracas"— y no el texto crudo que se escribió. Lo que diga el servidor,
// haya salido bien o mal, se le enseña al usuario en un toast.
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Box, Col, Row, Screen, Scroll, Txt, useAppColors } from '../ui';
import { Btn, Field, IconBtn, Input, SectionHead, Select } from '../components/primitives';
import { Icon } from '../components/Icon';
import { ApiError } from '../api/base';
import type { UpdateProfileInput } from '../api/controllers/auth.controller';
import { Profile } from '../data/mock';
import { useAuth } from '../store/auth';
import { toast } from '../store/toast';
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
  const updateProfile = useAuth((s) => s.updateProfile);

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
  const [guardando, setGuardando] = useState(false);

  const set = <K extends keyof Editable>(k: K, v: Editable[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const errores = {
    fullName: vacio(form.fullName) ? 'Poné tu nombre y apellido' : '',
    email: vacio(form.email)
      ? 'Poné tu correo'
      : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())
        ? 'Ese correo no parece válido'
        : '',
    // El estado puede venir vacío en cuentas viejas, creadas antes de que el
    // registro pidiera el perfil completo. Se exige acá porque el backend no
    // acepta una cadena vacía, y sin esta comprobación el usuario recibiría
    // el error del servidor en vez del rojo del campo que lo causa.
    state: vacio(form.state) ? 'Elegí tu estado' : '',
    city: vacio(form.city) ? 'Poné tu ciudad' : '',
  };
  const hayError = Object.values(errores).some(Boolean);

  const guardar = async () => {
    setIntento(true);
    if (hayError || guardando) return;

    // Se manda el formulario entero, sin calcular qué tocó el usuario: el
    // backend descarta lo que no cambió y responde `changed` con lo que sí.
    // Hacer ese diff acá sería repetir —mal— una regla que ya vive allá.
    const patch: UpdateProfileInput = {
      fullName: form.fullName.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      state: form.state,
      city: form.city.trim(),
    };

    setGuardando(true);
    try {
      // El mensaje sale del servidor, no de acá: distingue el guardado real de
      // "no había nada que cambiar", que para el usuario no son lo mismo.
      toast.ok(await updateProfile(patch));
      navigation.goBack();
    } catch (e) {
      // Se queda en la pantalla a propósito, con lo escrito intacto: volver
      // atrás tras un fallo dejaría al usuario creyendo que guardó, y con el
      // texto perdido si quisiera reintentar.
      toast.error(
        e instanceof ApiError
          ? e.message
          : 'No pudimos guardar. Revisa tu conexión.',
      );
    } finally {
      setGuardando(false);
    }
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
              <Field label="Estado" error={err('state')}>
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
            <Btn size="lg" onPress={() => void guardar()} disabled={guardando}>
              {guardando ? 'Guardando…' : 'Guardar cambios'}
            </Btn>
          </Box>
        </Scroll>
      </KeyboardAvoidingView>
    </Screen>
  );
}
