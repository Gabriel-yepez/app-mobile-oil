// La vista del toast. El estado vive en src/store/toast.
//
// Va ARRIBA y no abajo por dos estorbos que en esta app son la norma: la tab
// bar de cristal, que se comería un toast inferior, y el teclado —editar perfil
// es un formulario largo, y al guardar el teclado sigue abierto—. Arriba,
// debajo de la barra de estado, no lo tapa nada.
import React from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Box, Row, Touchable, Txt, useAppColors, useShadows } from '../ui';
import { Icon, type IconName } from './Icon';
import { useToast, type ToastKind } from '../store/toast';

const ICONO: Record<ToastKind, IconName> = {
  ok: 'check',
  error: 'alert',
  info: 'spark',
};

export function ToastHost() {
  const insets = useSafeAreaInsets();
  const c = useAppColors();
  const sh = useShadows();
  const toast = useToast((s) => s.toast);
  const hide = useToast((s) => s.hide);

  if (!toast) return null;

  // El icono lleva el color de estado; el fondo se queda en la superficie
  // neutra. Un toast de error en rojo pleno pesa demasiado para algo que se va
  // solo a los cinco segundos, y en oscuro el texto sobre rojo pierde contraste.
  const tono: Record<ToastKind, string> = {
    ok: c.ok,
    error: c.danger,
    info: c.accent,
  };
  const fondoIcono: Record<ToastKind, string> = {
    ok: c.okSoft,
    error: c.dangerSoft,
    info: c.accentSoft,
  };

  return (
    <Box
      pos="absolute"
      t={insets.top + 8}
      l={0}
      r={0}
      px="$lg"
      zi={1000}
      // Sin esto el contenedor a todo lo ancho se traga los toques de la
      // pantalla que hay debajo, aunque sea transparente.
      pointerEvents="box-none"
    >
      <Touchable
        // La `key` es lo que hace que un mensaje nuevo reanime la entrada: sin
        // ella React reusa la misma vista y el segundo toast aparece de golpe,
        // ya colocado, como si el primero hubiera cambiado de texto.
        key={toast.id}
        onPress={hide}
        fade
        transition="bouncy"
        enterStyle={{ opacity: 0, y: -16 }}
        opacity={toast.saliendo ? 0 : 1}
        y={toast.saliendo ? -16 : 0}
        fd="row"
        ai="center"
        gap="$md"
        br="$lg"
        px="$md"
        py="$md"
        bw={1}
        bc={c.line}
        bg={c.surface}
        style={sh.card}
      >
        <Row
          ai="center"
          jc="center"
          w={32}
          h={32}
          br={999}
          bg={fondoIcono[toast.kind]}
        >
          <Icon name={ICONO[toast.kind]} color={tono[toast.kind]} size={18} />
        </Row>

        {/* flex 1 para que el texto largo del servidor envuelva en vez de
            empujar la burbuja fuera de la pantalla. */}
        <Txt font="semi" fos={14} lh={19} f={1} col={c.ink}>
          {toast.text}
        </Txt>
      </Touchable>
    </Box>
  );
}
