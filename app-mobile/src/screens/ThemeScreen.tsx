// Tema — Sistema, Claro u Oscuro.
//
// El cambio se ve al instante y sin confirmar: la vista previa ES la pantalla,
// que se repinta entera al tocar. Un botón de "guardar" acá solo agregaría un
// paso para algo que ya se está viendo.
import React from 'react';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Box, Col, Row, Screen, Scroll, Touchable, Txt, useAppColors, useColorScheme } from '../ui';
import { Card, IconBtn, SectionHead } from '../components/primitives';
import { Icon, IconName } from '../components/Icon';
import { THEME_LABEL, ThemePref, useThemePref } from '../store/themePref';

const OPCIONES: { id: ThemePref; icon: IconName; detalle: string }[] = [
  { id: 'system', icon: 'settings', detalle: 'Sigue el ajuste de tu teléfono' },
  { id: 'light', icon: 'theme', detalle: 'Siempre claro' },
  { id: 'dark', icon: 'theme', detalle: 'Siempre oscuro' },
];

export function ThemeScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const c = useAppColors();
  const pref = useThemePref((s) => s.pref);
  const setPref = useThemePref((s) => s.setPref);
  const efectivo = useColorScheme();

  return (
    <Screen>
      <Row jc="space-between" ai="center" px="$lg" pb="$md" style={{ paddingTop: insets.top + 12 }}>
        <IconBtn
          icon={<Icon name="chevL" color={c.ink} size={20} />}
          onPress={() => navigation.goBack()}
        />
        <Txt font="display" fos={18}>
          Tema
        </Txt>
        <Box w={36} />
      </Row>

      <Scroll
        contentContainerStyle={{ paddingBottom: 48, gap: 18 }}
        showsVerticalScrollIndicator={false}
      >
        <Col gap="$sm">
          <SectionHead>Apariencia de la app</SectionHead>
          <Box px="$lg">
            <Card padded={false}>
              {OPCIONES.map((o, i) => {
                const activo = pref === o.id;
                return (
                  <Touchable
                    key={o.id}
                    onPress={() => setPref(o.id)}
                    fd="row"
                    ai="center"
                    gap="$md"
                    px="$lg"
                    py={14}
                    pressStyle={{ bg: '$bg2' }}
                    borderBottomWidth={i !== OPCIONES.length - 1 ? 1 : 0}
                    borderBottomColor="$line2"
                  >
                    <Box h={32} w={32} ai="center" jc="center" br={10} bg="$accentSoft">
                      <Icon name={o.icon} color={c.accent} size={18} />
                    </Box>
                    <Col f={1}>
                      <Txt font="semi" fos={14}>{THEME_LABEL[o.id]}</Txt>
                      <Txt fos={12} tone="muted" mt={1}>{o.detalle}</Txt>
                    </Col>
                    {/* Un solo Box para los dos estados, con los mismos hooks:
                        dos ramas de un ternario, una animada y otra no, rompen
                        el orden de hooks de Tamagui. */}
                    <Box
                      h={24}
                      w={24}
                      ai="center"
                      jc="center"
                      br="$pill"
                      transition="bouncy"
                      bg={activo ? '$accent' : 'transparent'}
                      bw={activo ? 0 : 2}
                      bc="$line"
                    >
                      {activo ? <Icon name="check" color="#fff" size={15} /> : null}
                    </Box>
                  </Touchable>
                );
              })}
            </Card>
          </Box>
        </Col>
      </Scroll>
    </Screen>
  );
}
