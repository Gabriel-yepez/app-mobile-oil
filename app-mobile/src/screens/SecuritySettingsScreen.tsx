import React, { useState } from 'react';
import { Switch } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Box, Col, Row, Screen, Scroll, Touchable, Txt, useAppColors } from '../ui';
import { Card, IconBtn, SectionHead } from '../components/primitives';
import { Icon } from '../components/Icon';

export function SecuritySettingsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const c = useAppColors();
  const [biometricEnabled, setBiometricEnabled] = useState(false);

  return (
    <Screen>
      <Row jc="space-between" ai="center" px="$lg" pb="$md" style={{ paddingTop: insets.top + 12 }}>
        <IconBtn
          icon={<Icon name="chevL" color={c.ink} size={20} />}
          onPress={() => navigation.goBack()}
        />
        <Txt font="display" fos={18}>
          Seguridad
        </Txt>
        <Box w={36} />
      </Row>

      <Scroll
        contentContainerStyle={{ paddingBottom: 48, gap: 18 }}
        showsVerticalScrollIndicator={false}
      >
        <Col gap="$sm">
          <SectionHead>Acceso</SectionHead>
          <Box px="$lg">
            <Card padded={false}>
              <Touchable
                fd="row"
                ai="center"
                gap="$md"
                px="$lg"
                py={14}
                pressStyle={{ bg: '$bg2' }}
                borderBottomWidth={1}
                borderBottomColor="$line2"
              >
                <Box h={32} w={32} ai="center" jc="center" br={10} bg="$accentSoft">
                  <Icon name="shield" color={c.accent} size={18} />
                </Box>
                <Txt f={1} font="semi" fos={14}>Cambiar contraseña</Txt>
                <Icon name="chevR" color={c.muted2} size={20} />
              </Touchable>
              <Row
                ai="center"
                gap="$md"
                px="$lg"
                py={14}
              >
                <Box h={32} w={32} ai="center" jc="center" br={10} bg="$accentSoft">
                  <Icon name="eye" color={c.accent} size={18} />
                </Box>
                <Col f={1}>
                  <Txt font="semi" fos={14}>Inicio con biometría</Txt>
                  <Txt fos={13} tone="muted">Usa Face ID o huella</Txt>
                </Col>
                <Switch
                  value={biometricEnabled}
                  onValueChange={setBiometricEnabled}
                  trackColor={{ false: c.line, true: c.accent }}
                />
              </Row>
            </Card>
          </Box>
        </Col>

        <Col gap="$sm">
          <SectionHead>Cuenta</SectionHead>
          <Box px="$lg">
            <Card padded={false}>
              <Touchable
                fd="row"
                ai="center"
                gap="$md"
                px="$lg"
                py={14}
                pressStyle={{ bg: '$dangerSoft' }}
              >
                <Box h={32} w={32} ai="center" jc="center" br={10} bg="rgba(239,68,68,0.1)">
                  <Icon name="trash" color={c.danger} size={18} />
                </Box>
                <Txt f={1} font="semi" fos={14} tone="danger">Eliminar cuenta</Txt>
                <Icon name="chevR" color={c.muted2} size={20} />
              </Touchable>
            </Card>
          </Box>
        </Col>
      </Scroll>
    </Screen>
  );
}
