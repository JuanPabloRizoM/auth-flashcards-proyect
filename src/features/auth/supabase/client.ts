// El polyfill va primero: supabase-js usa `URL` y `URLSearchParams`, y la implementación de
// React Native no está completa. Es lo que indica la guía oficial de Supabase para Expo.
import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import type { SupabaseConfig } from './config';

/**
 * Creación del cliente de Supabase.
 *
 * Es el **único** archivo del proyecto que importa `@supabase/supabase-js`. Todo lo demás
 * habla con `AuthService` (docs/ARCHITECTURE.md, regla 2).
 *
 * Las opciones siguen la recomendación oficial vigente para Expo, y se separan por
 * plataforma porque el mecanismo de sesión es genuinamente distinto:
 *
 * - **Web**: el almacenamiento por defecto de la librería (`localStorage`) y
 *   `detectSessionInUrl: true`, que es lo que convierte el regreso de Google en una sesión.
 * - **iOS y Android**: `AsyncStorage` como almacén, y `detectSessionInUrl: false`, porque
 *   ahí el regreso llega por deep link y lo procesa el adaptador de OAuth.
 *
 * En nativo, además, el refresco automático del token se ata al ciclo de vida de la
 * aplicación: mientras está en segundo plano no tiene sentido renovar nada, y al volver al
 * primer plano hay que renovar antes de que la persona toque nada.
 */

export function createSupabaseClient(config: SupabaseConfig): SupabaseClient {
  const isWeb = Platform.OS === 'web';

  const client = createClient(config.url, config.publishableKey, {
    auth: {
      ...(isWeb ? {} : { storage: AsyncStorage }),
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: isWeb,
    },
  });

  if (!isWeb) {
    AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void client.auth.startAutoRefresh();
      } else {
        void client.auth.stopAutoRefresh();
      }
    });
  }

  return client;
}
