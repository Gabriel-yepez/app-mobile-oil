// Agregar vehículo — Paso 1/3: elegir Carro o Moto
import React, { useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Box, Col, Row, Touchable, Txt, useAppColors, useShadows } from '../ui';
import { palette } from '../theme';
import { Btn, IconBtn } from '../components/primitives';
import { StepHeader } from '../components/StepHeader';
import { Icon } from '../components/Icon';
import { RootScreenProps } from '../navigation/types';
import { useVehicles } from '../store/useVehicles';
import { quedaCupoVehiculo, useSuscripcion } from '../store/suscripcion';

type Kind = 'car' | 'moto';

const OPTIONS: { kind: Kind; title: string; subtitle: string; gradient: [string, string] }[] = [
  { kind: 'car', title: 'Carro', subtitle: 'Sedán, hatchback, SUV, camioneta…', gradient: [palette.accent2, palette.primary] },
  { kind: 'moto', title: 'Moto', subtitle: 'Bera, Empire, MD, Yamaha, Suzuki…', gradient: ['#DC2626', '#7F1D1D'] },
];

export function AddVehicleTypeScreen({ navigation }: RootScreenProps<'AddVehicleType'>) {
  const insets = useSafeAreaInsets();
  const c = useAppColors();
  const sh = useShadows();
  const [selected, setSelected] = useState<Kind>('car');
  const cantidad = useVehicles((s) => s.vehicles.length);
  const suscripcion = useSuscripcion((s) => s.suscripcion);
  // Se avisa acá, en el paso 1, y no al guardar en el paso 3: llenar tres
  // pantallas para enterarse al final de que no cabía es lo peor que se le
  // puede hacer al usuario. El servidor aplica el tope igual.
  const hayCupo = quedaCupoVehiculo(suscripcion, cantidad);
  const tope = suscripcion?.plan.maxVehicles ?? null;

  return (
    <Box f={1} bg="$bg">
      <StepHeader step={1} total={3} onBack={() => navigation.goBack()} />

      <Col px="$2xl" pb="$sm" pt="$2xl">
        <Txt font="display" fos={30} lh={33} ls={-0.6}>
          ¿Qué vas a registrar?
        </Txt>
        <Txt fos={15} tone="muted" mt="$sm">
          Elige el tipo de vehículo para comenzar.
        </Txt>
      </Col>

      <Col gap={14} px="$xl" py="$2xl">
        {OPTIONS.map((o) => {
          const isSelected = selected === o.kind;
          return (
            <Touchable
              key={o.kind}
              onPress={() => setSelected(o.kind)}
              fade
              sink
              transition="quick"
              fd="row"
              ai="center"
              gap="$lg"
              br="$lg"
              bg="$surface"
              p={18}
              bw={isSelected ? 2 : 1.5}
              bc={isSelected ? '$accent' : '$line'}
              style={isSelected ? undefined : sh.card}
            >
              <LinearGradient
                colors={o.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ width: 72, height: 72, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }}
              >
                <Icon name={o.kind === 'car' ? 'car' : 'moto'} color="#fff" size={36} />
              </LinearGradient>
              <Col f={1}>
                <Txt font="display" fos={20} ls={-0.3}>{o.title}</Txt>
                <Txt fos={13} tone="muted" mt={2}>{o.subtitle}</Txt>
              </Col>
              {/* UN SOLO Box para los dos estados, no un ternario con uno por
                  rama. Las dos ramas caían en la misma posición del árbol, así
                  que React reconciliaba en vez de remontar — y como una estaba
                  animada (`transition`) y la otra no, Tamagui llamaba distintos
                  hooks en cada render: "Should have a queue. You are likely
                  calling Hooks conditionally", y la pantalla quedaba en blanco
                  al cambiar de tipo. Manteniendo el mismo componente con los
                  mismos hooks, además, el cambio de estado se anima. */}
              <Box
                h={28}
                w={28}
                ai="center"
                jc="center"
                br="$pill"
                transition="bouncy"
                bg={isSelected ? '$accent' : 'transparent'}
                bw={isSelected ? 0 : 2}
                bc="$line"
              >
                {isSelected ? <Icon name="check" color="#fff" size={18} /> : null}
              </Box>
            </Touchable>
          );
        })}
      </Col>

      {/* helper */}
      <Row mx="$xl" ai="flex-start" gap={10} br={14} bg="$bg2" p={14}>
        <Box mt={2}>
          <Icon name="shield" color={c.accent} size={20} />
        </Box>
        <Txt f={1} fos={13} lh={19.5} tone="muted">
          {hayCupo
            ? tope === null
              ? 'Tu plan no tiene tope de vehículos. Tu información se guarda solo en tu cuenta.'
              : `Tu plan ${suscripcion?.plan.name} permite hasta ${tope} vehículos; llevas ${cantidad}. Tu información se guarda solo en tu cuenta.`
            : `Llegaste al tope de ${tope} vehículos de tu plan ${suscripcion?.plan.name}. Pásate a Pro para agregar más.`}
        </Txt>
      </Row>

      <Box f={1} />
      <Box px="$xl" pb={Math.max(insets.bottom, 24) + 12}>
        {hayCupo ? (
          <Btn
            kind="primary"
            size="lg"
            icon={<Icon name="arrow" color="#fff" size={18} />}
            onPress={() => navigation.navigate('AddVehicleForm', { kind: selected })}
          >
            Continuar
          </Btn>
        ) : (
          <Btn kind="primary" size="lg" onPress={() => navigation.navigate('Subscription')}>
            Ver planes
          </Btn>
        )}
      </Box>
    </Box>
  );
}
