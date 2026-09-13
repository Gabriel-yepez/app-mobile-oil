// Ref imperativa del navegador + cola de una sola entrada.
//
// Cuando la app arranca DESDE una notificación (proceso frío), el navegador
// todavía no está montado: la navegación se guarda y se ejecuta en onReady.
import { createNavigationContainerRef } from '@react-navigation/native';
import { RootStackParamList } from './types';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

let pending: (() => void) | null = null;

export function runWhenReady(fn: () => void): void {
  if (navigationRef.isReady()) fn();
  else pending = fn;
}

export function flushPendingRoute(): void {
  const fn = pending;
  pending = null;
  fn?.();
}
