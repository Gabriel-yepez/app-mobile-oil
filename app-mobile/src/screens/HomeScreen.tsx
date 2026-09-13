// Home — hero fijo con el vehículo activo, y debajo los widgets que el usuario
// eligió y ordenó. El contenido de cada widget vive en src/home/widgets/; acá
// solo se decide el hero y se recorre el orden.
import React, { useState, useRef } from 'react';
import { FlatList, Modal, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Box, Col, Row, Scroll, Touchable, Txt, useAppColors } from '../ui';
import { Avatar, VehicleThumb } from '../components/primitives';
import { HeroSurface } from '../components/HeroSurface';
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
  const triggerRef = useRef<View>(null);
  const [pickerLayout, setPickerLayout] = useState({ top: 0, left: 0, width: 0 });
  const [pickerStep, setPickerStep] = useState<'type' | 'vehicles'>('type');
  const [selectedType, setSelectedType] = useState<'car' | 'moto' | null>(null);

  // Mientras no terminó de leerse el layout guardado no se pinta la lista: si
  // no, se ve el orden de fábrica reacomodarse solo un instante después.
  const widgets = hydrated ? visibleWidgets(layout) : [];

  return (
    <Box f={1} bg="$bg3">
      {/* Hero fijo: no es un widget. Es el ancla del vehículo activo del que
          dependen gauge, techReadout y quickActions. Al estar fuera del Scroll,
          queda siempre visible (sticky) en la parte superior. */}
      <HeroSurface
        style={{
          paddingTop: insets.top + 12,
          paddingHorizontal: 20,
          paddingBottom: 20,
          borderBottomLeftRadius: 32,
          borderBottomRightRadius: 32,
          overflow: 'hidden',
          zIndex: 10,
        }}
      >


        <Row mb="$lg" jc="space-between" ai="center">
          <Row f={1} ai="center" gap={12}>
            <Avatar
              name={profile.fullName}
              size={44}
              onPress={() => navigation.navigate('Profile')}
            />
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
          ref={triggerRef as any}
          onPress={() => {
            triggerRef.current?.measure((x, y, w, h, px, py) => {
              setPickerLayout({ top: py + h + 8, left: px, width: w });
              setPickerStep('type');
              setSelectedType(null);
              setPickerOpen(true);
            });
          }}
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
      </HeroSurface>

      <Scroll bg="$bg3" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Widgets, en el orden que eligió el usuario. */}
        <Col gap={18} pt="$lg">
          {widgets.map((id) => (
            <Box key={id}>{HOME_WIDGETS[id].render()}</Box>
          ))}

          {/* Cierra la lista con la misma card delineada que "Agregar vehículo":
              es la puerta de entrada a personalizar, y al final es donde se
              busca después de leer los widgets que ya están. */}
          <Touchable
            onPress={() => navigation.navigate('CustomizeHome')}
            fade
            sink
            transition="quick"
            mx="$lg"
            h={56}
            fd="row"
            ai="center"
            jc="center"
            gap={10}
            br="$lg"
            bw={1}
            bc="$accent"
            borderStyle="dashed"
            bg="$surfaceDim"
          >
            <Icon name="sliders" color={c.accent} size={18} />
            <Txt font="semi" fos={14} tone="accent">Personalizar inicio</Txt>
          </Touchable>
        </Col>
      </Scroll>

      {/* selector de vehículo activo */}
      <Modal visible={pickerOpen} transparent animationType="fade" onRequestClose={() => setPickerOpen(false)}>
        <Touchable f={1} bg="transparent" onPress={() => setPickerOpen(false)}>
          <Box
            pos="absolute"
            t={pickerLayout.top}
            l={pickerLayout.left}
            w={pickerLayout.width}
            transition="bouncy"
            enterStyle={{ y: -10, opacity: 0 }}
            shadowColor="#000"
            shadowOffset={{ width: 0, height: 10 }}
            shadowOpacity={0.15}
            shadowRadius={20}
            style={{ elevation: 10 }}
          >
            <Box
              br="$xl"
              bw={1}
              bc="rgba(255,255,255,0.1)"
              overflow="hidden"
            >
              <BlurView intensity={60} tint="dark" style={{ backgroundColor: 'rgba(255,255,255,0.06)', paddingVertical: 12 }}>
            {pickerStep === 'type' ? (
              <Col>
                <Touchable
                  fd="row"
                  ai="center"
                  gap="$md"
                  px="$md"
                  py="$sm"
                  br="$md"
                  mx="$sm"
                  pressStyle={{ bg: 'rgba(255,255,255,0.1)' }}
                  onPress={() => {
                    setSelectedType('car');
                    setPickerStep('vehicles');
                  }}
                >
                  <VehicleThumb kind="car" color="rgba(0,0,0,0.25)" size={40} />
                  <Col f={1}>
                    <Txt font="bold" fos={14} tone="onDark">Carro</Txt>
                  </Col>
                  <Icon name="chevR" color="rgba(255,255,255,0.5)" size={18} />
                </Touchable>
                <Touchable
                  fd="row"
                  ai="center"
                  gap="$md"
                  px="$md"
                  py="$sm"
                  br="$md"
                  mx="$sm"
                  mt="$xs"
                  pressStyle={{ bg: 'rgba(255,255,255,0.1)' }}
                  onPress={() => {
                    setSelectedType('moto');
                    setPickerStep('vehicles');
                  }}
                >
                  <VehicleThumb kind="moto" color="rgba(0,0,0,0.25)" size={40} />
                  <Col f={1}>
                    <Txt font="bold" fos={14} tone="onDark">Moto</Txt>
                  </Col>
                  <Icon name="chevR" color="rgba(255,255,255,0.5)" size={18} />
                </Touchable>
              </Col>
            ) : (
              <Col>
                <Touchable
                  fd="row"
                  ai="center"
                  gap="$sm"
                  px="$md"
                  py="$sm"
                  br="$md"
                  mx="$sm"
                  mb="$sm"
                  pressStyle={{ bg: 'rgba(255,255,255,0.1)' }}
                  onPress={() => setPickerStep('type')}
                >
                  <Icon name="chevL" color="#FFFFFF" size={18} />
                  <Txt font="semi" fos={13} tone="onDark">
                    Volver
                  </Txt>
                </Touchable>
                <Box h={1} bg="rgba(255,255,255,0.15)" mb="$sm" mx="$sm" />
                <FlatList
                  data={vehicles.filter((v) => v.kind === selectedType)}
                  keyExtractor={(v) => v.id}
                  renderItem={({ item }) => (
                    <Touchable
                      fd="row"
                      ai="center"
                      gap="$md"
                      px="$md"
                      py="$sm"
                      br="$md"
                      mx="$sm"
                      pressStyle={{ bg: 'rgba(255,255,255,0.1)' }}
                      onPress={() => {
                        setActiveVehicle(item.id);
                        setPickerOpen(false);
                      }}
                    >
                      <VehicleThumb kind={item.kind} color={item.color} size={40} />
                      <Col f={1}>
                        <Txt font="bold" fos={14} tone="onDark">
                          {item.brand} {item.model}
                        </Txt>
                        <Txt font="monoMed" fos={11} tone="onDarkMuted">
                          {item.plate} · {item.year}
                        </Txt>
                      </Col>
                      {item.id === active.id ? <Icon name="check" color={c.accent} size={18} /> : null}
                    </Touchable>
                  )}
                  ListEmptyComponent={
                    <Box px="$md" py="$sm" ai="center">
                      <Txt tone="onDarkMuted" fos={13}>No hay vehículos</Txt>
                    </Box>
                  }
                />
              </Col>
            )}
            </BlurView>
            </Box>
          </Box>
        </Touchable>
      </Modal>
    </Box>
  );
}
