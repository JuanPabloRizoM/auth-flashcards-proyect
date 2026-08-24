import { AppState, Platform } from 'react-native';

import { alwaysVisible, type VisibilitySource } from './activeTime';

/**
 * Visibilidad real de la superficie, por plataforma.
 *
 * Es el único archivo que conoce el mecanismo concreto; el cronómetro solo ve el contrato
 * `VisibilitySource`, así que puede probarse con una fuente falsa sin simular el navegador.
 */
export function createPlatformVisibility(): VisibilitySource {
  if (Platform.OS === 'web') {
    // `document` puede no existir durante el renderizado en servidor de Expo Router.
    const doc = typeof document === 'undefined' ? undefined : document;
    if (!doc) return alwaysVisible;

    return {
      isVisible: () => doc.visibilityState !== 'hidden',
      subscribe: (listener) => {
        const handler = () => listener(doc.visibilityState !== 'hidden');
        doc.addEventListener('visibilitychange', handler);
        return () => doc.removeEventListener('visibilitychange', handler);
      },
    };
  }

  return {
    // `inactive` (multitarea de iOS, centro de notificaciones) tampoco es estudiar.
    isVisible: () => AppState.currentState === 'active',
    subscribe: (listener) => {
      const subscription = AppState.addEventListener('change', (state) => {
        listener(state === 'active');
      });
      return () => subscription.remove();
    },
  };
}
