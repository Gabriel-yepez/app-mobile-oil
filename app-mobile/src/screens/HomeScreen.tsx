// Home — hero fijo con el vehículo activo, y debajo los widgets que el usuario
// eligió y ordenó. El contenido de cada widget vive en src/home/widgets/; acá
// solo se decide el hero y se recorre el orden.
import React, { useState } from 'react';
import { FlatList, Modal } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Box, Col, Row, Scroll, Touchable, Txt, useAppColors } from '../ui';
import { Avatar, VehicleThumb } from '../components/primitives';
import { Icon } from '../components/Icon';
import { useActiveVehicle, useOpenAlerts, useStore } from '../store/useStore';
import { useHomeLayout } from '../store/homeLayout';
import { visibleWidgets } from '../home/layout';
import { HOME_WIDGETS } from '../home/registry';
import { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function HomeScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const c = useAppColors();
  const vehicles = useStore((s) => s.vehicles);
  const profile = useStore((s) => s.profile);
  const setActiveVehicle = useStore((s) => s.setActiveVehicle);
  const active = useActiveVehicle();
  const openAlerts = useOpenAlerts();
  const layout = useHomeLayout((s) => s.layout);
  const hydrated = useHomeLayout((s) => s.hydrated);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Mientras no terminó de leerse el layout guardado no se pinta la lista: si
  // no, se ve el orden de fábrica reacomodarse solo un instante después.
  const widgets = hydrated ? visibleWidgets(layout) : [];

  return (
    <Box f={1} bg="$bg3">
      <Scroll bg="$bg3" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Fondo absoluto para cubrir el overscroll (bounce) superior en iOS/Android con el color del header */}
        <Box pos="absolute" t={-1000} l={0} r={0} h={1000} bg={c.primary} />
        
        {/* Hero fijo: no es un widget. Es el ancla del vehículo activo del que
            dependen gauge, techReadout y quickActions — si se pudiera ocultar,
            esos widgets mostrarían datos de un vehículo imposible de cambiar. */}
        <LinearGradient
          colors={[c.primary, c.primary2]}
          style={{
            paddingTop: insets.top + 12,
            paddingHorizontal: 20,
            paddingBottom: 20,
            borderBottomLeftRadius: 32,
            borderBottomRightRadius: 32,
            overflow: 'hidden',
          }}
        >


          <Row mb="$lg" jc="space-between" ai="center">
            <Row f={1} ai="center" gap={12}>
              <Avatar
                name={profile.fullName}
                size={44}
                onPress={() => navigation.navigate('Profile')}
              />
              <Col f={1}>
                <Txt font="display" fos={22} tone="onDark" ls={-0.4}>
                  Tu tablero del día
                </Txt>
              </Col>
            </Row>
            <Row gap={8}>
              <Touchable
                onPress={() => navigation.navigate('CustomizeHome')}
                fade
                transition="quick"
                h={40}
                w={40}
                ai="center"
                jc="center"
                br={12}
                bg="rgba(255,255,255,0.1)"
              >
                <Icon name="sliders" color="#fff" size={20} />
              </Touchable>
              <Touchable
                onPress={() => navigation.navigate('Alerts')}
                fade
                transition="quick"
                h={40}
                w={40}
                ai="center"
                jc="center"
                br={12}
                bg="rgba(255,255,255,0.1)"
              >
                <Icon name="bell" color="#fff" size={20} />
                {openAlerts > 0 ? (
                  <Box pos="absolute" r={8} t={8} h={8} w={8} br="$pill" bg="$warn" />
                ) : null}
              </Touchable>
            </Row>
          </Row>

          <Touchable
            onPress={() => setPickerOpen(true)}
            fade
            transition="quick"
            fd="row"
            ai="center"
            gap={10}
            br={14}
            bw={1}
            bc="rgba(255,255,255,0.1)"
            bg="rgba(255,255,255,0.06)"
            px="$md"
            py={10}
          >
            <VehicleThumb kind={active.kind} color={active.color} size={36} />
            <Col f={1}>
              <Txt font="bold" fos={14} tone="onDark">
                {active.brand} {active.model}
              </Txt>
              <Txt font="monoMed" fos={11} col="rgba(255,255,255,0.65)">
                {active.plate} · {active.year}
              </Txt>
            </Col>
            <Icon name="chevD" color="rgba(255,255,255,0.7)" size={20} />
          </Touchable>
        </LinearGradient>

        {/* Widgets, en el orden que eligió el usuario. */}
        <Col gap={18} pt="$lg">
          {widgets.map((id) => (
            <Box key={id}>{HOME_WIDGETS[id].render()}</Box>
          ))}
        </Col>
      </Scroll>

      {/* selector de vehículo activo */}
      <Modal visible={pickerOpen} transparent animationType="fade" onRequestClose={() => setPickerOpen(false)}>
        <Touchable f={1} jc="flex-end" bg="$scrim" onPress={() => setPickerOpen(false)}>
          <Box
            borderTopLeftRadius="$xl"
            borderTopRightRadius="$xl"
            bg="$surface"
            pt="$md"
            pb={insets.bottom + 12}
            transition="bouncy"
            enterStyle={{ y: 40, opacity: 0 }}
          >
            <FlatList
              data={vehicles}
              keyExtractor={(v) => v.id}
              renderItem={({ item }) => (
                <Touchable
                  fd="row"
                  ai="center"
                  gap="$md"
                  px="$2xl"
                  py="$md"
                  pressStyle={{ bg: '$bg2' }}
                  onPress={() => {
                    setActiveVehicle(item.id);
                    setPickerOpen(false);
                  }}
                >
                  <VehicleThumb kind={item.kind} color={item.color} size={40} />
                  <Col f={1}>
                    <Txt font="bold" fos={14}>
                      {item.brand} {item.model}
                    </Txt>
                    <Txt font="monoMed" fos={11} tone="muted">
                      {item.plate} · {item.year}
                    </Txt>
                  </Col>
                  {item.id === active.id ? <Icon name="check" color={c.accent} size={18} /> : null}
                </Touchable>
              )}
            />
          </Box>
        </Touchable>
      </Modal>
    </Box>
  );
}
