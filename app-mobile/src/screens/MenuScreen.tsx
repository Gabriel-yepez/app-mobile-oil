// Menú — tercer destino del tab bar. No tiene contenido propio: es el índice
// de todo lo que dejó de ser un tab cuando la barra bajó a tres destinos.
import React from 'react';
import { Linking } from 'react-native';
import Constants from 'expo-constants';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Box, Col, Row, Scroll, Touchable, Txt, useAppColors } from '../ui';
import { Card, SectionHead } from '../components/primitives';
import { Icon, IconName } from '../components/Icon';
import { useStore } from '../store/useStore';
import { usePlan, useSuscripcion } from '../store/suscripcion';
import { toast } from '../store/toast';
import { mailtoSoporte } from '../utils/soporte';
import { useNotifPrefs } from '../store/notifPrefs';
import { THEME_LABEL, useThemePref } from '../store/themePref';
import { useAuth } from '../store/auth';
import { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type Fila = { k: string; v?: string; icon: IconName; onPress: () => void };

/** Abre el correo con el mensaje a soporte ya encabezado. `openURL` rechaza
 *  si no hay app de correo, y una promesa rechazada sin atrapar tumba la app
 *  en release: ahí se le da la dirección para que escriba por su cuenta. */
function abrirSoporte(url: string, email: string) {
  Linking.openURL(url).catch(() => {
    toast.info(`No encontramos una app de correo. Escríbenos a ${email}.`);
  });
}

export function MenuScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const c = useAppColors();
  const profile = useStore((s) => s.profile);
  const signOut = useAuth((s) => s.signOut);
  const notifEnabled = useNotifPrefs((s) => s.prefs.enabled);
  const themePref = useThemePref((s) => s.pref);
  const plan = usePlan();
  const soporte = useSuscripcion((s) => s.soporte);

  const cuenta: Fila[] = [
    { k: 'Mi perfil', v: profile.fullName, icon: 'user', onPress: () => navigation.navigate('Profile') },
    { k: 'Historial', icon: 'history', onPress: () => navigation.navigate('History') },
  ];

  const gestion: Fila[] = [
    {
      k: 'Seguridad de tu cuenta',
      icon: 'shield',
      onPress: () => navigation.navigate('SecuritySettings'),
    },
    {
      k: 'Tema',
      v: THEME_LABEL[themePref],
      icon: 'theme',
      onPress: () => navigation.navigate('Theme'),
    },
    {
      k: 'Notificaciones',
      v: notifEnabled ? 'Activadas' : 'Desactivadas',
      icon: 'settings',
      onPress: () => navigation.navigate('Notifications'),
    },
  ];

  // Un solo enlace: el detalle entero (topes, consumo, qué incluye, cambiar de
  // plan) vive en su propia pantalla. Acá alcanza con el plan a la vista.
  const planFilas: Fila[] = [
    {
      k: 'Mi suscripción',
      v: plan ? `Plan ${plan.name}` : '',
      icon: 'spark',
      onPress: () => navigation.navigate('Subscription'),
    },
  ];

  // La dirección la configura el backend (SUPPORT_EMAIL). Sin ella la fila no
  // aparece: mejor eso que un botón que no lleva a ningún lado.
  const email = soporte?.email;
  const ayuda: Fila[] = email
    ? [
        {
          k: 'Contactar soporte',
          v: soporte.priority ? 'Prioritario' : undefined,
          icon: 'help',
          onPress: () =>
            abrirSoporte(
              mailtoSoporte({
                email,
                priority: soporte.priority,
                cuenta: profile.email,
                plan: plan?.name ?? '—',
                version: Constants.expoConfig?.version ?? '—',
              }),
              email,
            ),
        },
      ]
    : [];

  const acerca: Fila[] = [
    {
      k: 'Términos y condiciones',
      icon: 'flag',
      onPress: () => console.log('Abrir Términos (Próximamente)'),
    },
    {
      k: 'Privacidad',
      icon: 'shield',
      onPress: () => console.log('Abrir Privacidad (Próximamente)'),
    },
  ];

  const grupo = (filas: Fila[]) => (
    <Box px="$lg">
      <Card padded={false}>
        {filas.map((r, i) => (
          <Touchable
            key={r.k}
            onPress={r.onPress}
            fd="row"
            ai="center"
            gap="$md"
            px="$lg"
            py={14}
            pressStyle={{ bg: '$bg2' }}
            borderBottomWidth={i !== filas.length - 1 ? 1 : 0}
            borderBottomColor="$line2"
          >
            <Box h={32} w={32} ai="center" jc="center" br={10} bg="$accentSoft">
              <Icon name={r.icon} color={c.accent} size={18} />
            </Box>
            <Txt f={1} font="semi" fos={14}>{r.k}</Txt>
            {r.v ? <Txt fos={13} tone="muted">{r.v}</Txt> : null}
            <Icon name="chevR" color={c.muted2} size={20} />
          </Touchable>
        ))}
      </Card>
    </Box>
  );

  return (
    <Box f={1} bg="$bg3">
      <Row jc="space-between" px="$xl" pb={14} pt={insets.top + 12}>
        <Col>
          <Txt font="display" fos={32} ls={-0.5}>
            Menú
          </Txt>
        </Col>
      </Row>

      <Scroll bg="$bg3" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        <SectionHead>Cuenta</SectionHead>
        {grupo(cuenta)}

        <Box pt={18}>
          <SectionHead>Ajustes</SectionHead>
          {grupo(gestion)}
        </Box>

        <Box pt={18}>
          <SectionHead>Plan</SectionHead>
          {grupo(planFilas)}
        </Box>

        {/* Sin soporte configurado, ni la sección: un título sobre una
            tarjeta vacía parece un error. */}
        {ayuda.length > 0 ? (
          <Box pt={18}>
            <SectionHead>Ayuda</SectionHead>
            {grupo(ayuda)}
          </Box>
        ) : null}

        <Box pt={18}>
          <SectionHead>Acerca de</SectionHead>
          {grupo(acerca)}
        </Box>

        {/* Cerrar sesión se mudó acá desde Perfil: ahora que el perfil dejó de
            ser un destino raíz, el menú es el lugar donde se lo busca. */}
        <Box px="$lg" pt={18}>
          <Touchable
            onPress={() => {
              // Primero se cierra la sesión —revoca el refresh en el servidor
              // y borra los tokens del dispositivo— y después se navega. Al
              // revés, el Login aparecería con la sesión todavía viva.
              void signOut().then(() =>
                navigation.reset({ index: 0, routes: [{ name: 'Login' }] }),
              );
            }}
            transition="quick"
            h={48}
            fd="row"
            ai="center"
            jc="center"
            gap="$sm"
            br="$md"
            bw={1.5}
            bc="$danger"
            bg="transparent"
            pressStyle={{ bg: '$bg2' }}
          >
            <Icon name="logout" color={c.danger} size={20} />
            <Txt font="semi" fos={15} tone="danger">Cerrar sesión</Txt>
          </Touchable>
          <Txt font="monoMed" fos={11} tone="muted2" ls={0.4} ta="center" mt="$md">
            Ruédalo · v1.0.0
          </Txt>
        </Box>
      </Scroll>
    </Box>
  );
}
