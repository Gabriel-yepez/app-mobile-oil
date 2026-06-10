// Wrappers CSS para usar className (Tailwind) en primitivas de React Native.
// Patrón de la skill expo-tailwind-setup, adaptado: sin expo-router ni reanimated.
import React from 'react';
import {
  View as RNView,
  Text as RNText,
  Pressable as RNPressable,
  ScrollView as RNScrollView,
  TouchableHighlight as RNTouchableHighlight,
  TextInput as RNTextInput,
  StyleSheet,
} from 'react-native';
import { useCssElement, useNativeVariable as useFunctionalVariable } from 'react-native-css';

// Hook para leer variables CSS desde JS
export const useCSSVariable =
  process.env.EXPO_OS !== 'web'
    ? useFunctionalVariable
    : (variable: string) => `var(${variable})`;

// View
export type ViewProps = React.ComponentProps<typeof RNView> & { className?: string };

export const View = (props: ViewProps) => {
  return useCssElement(RNView, props, { className: 'style' });
};
View.displayName = 'CSS(View)';

// Text
export const Text = (props: React.ComponentProps<typeof RNText> & { className?: string }) => {
  return useCssElement(RNText, props, { className: 'style' });
};
Text.displayName = 'CSS(Text)';

// ScrollView
export const ScrollView = (
  props: React.ComponentProps<typeof RNScrollView> & {
    className?: string;
    contentContainerClassName?: string;
  }
) => {
  // Cast: el tipo genérico de ScrollView excede el límite de complejidad de TS
  return useCssElement(RNScrollView as React.ComponentType<any>, props, {
    className: 'style',
    contentContainerClassName: 'contentContainerStyle',
  });
};
ScrollView.displayName = 'CSS(ScrollView)';

// Pressable
export const Pressable = (
  props: React.ComponentProps<typeof RNPressable> & { className?: string }
) => {
  // Cast: PressableProps excede el límite de complejidad de TS en DotNotation
  return useCssElement(RNPressable as React.ComponentType<any>, props, { className: 'style' });
};
Pressable.displayName = 'CSS(Pressable)';

// TextInput
export const TextInput = (
  props: React.ComponentProps<typeof RNTextInput> & { className?: string }
) => {
  return useCssElement(RNTextInput, props, { className: 'style' });
};
TextInput.displayName = 'CSS(TextInput)';

// TouchableHighlight con extracción de underlayColor
function XXTouchableHighlight(props: React.ComponentProps<typeof RNTouchableHighlight>) {
  const { underlayColor, ...style } = (StyleSheet.flatten(props.style) || {}) as Record<string, unknown>;
  return (
    <RNTouchableHighlight
      underlayColor={underlayColor as string | undefined}
      {...props}
      style={style}
    />
  );
}

export const TouchableHighlight = (
  props: React.ComponentProps<typeof RNTouchableHighlight> & { className?: string }
) => {
  // Cast: TouchableHighlightProps excede el límite de complejidad de TS en DotNotation
  return useCssElement(XXTouchableHighlight as React.ComponentType<any>, props, { className: 'style' });
};
TouchableHighlight.displayName = 'CSS(TouchableHighlight)';
