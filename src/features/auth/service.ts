import AsyncStorage from '@react-native-async-storage/async-storage';

import { createFakeAuthService } from './fakeAuthService';
import { createSupabaseClient } from './supabase/client';
import { readSupabaseConfig, type SupabaseConfigResult } from './supabase/config';
import { createOAuthPlatform, oauthRedirectTo } from './supabase/platform';
import {
  createSupabaseAuthService,
  createUnconfiguredAuthService,
} from './supabase/supabaseAuthService';
import type { AuthService } from './types';

/**
 * Qué servicio de autenticación usa la aplicación.
 *
 * Tres casos, y solo tres:
 *
 * 1. **Configurado**: Supabase Auth real.
 * 2. **Sin configurar**: un servicio que rechaza todo con `sin-configuracion`. La aplicación
 *    arranca, la pantalla de acceso lo explica y **no se crea ninguna sesión**.
 * 3. **Doble de pruebas**: solo en desarrollo y solo con la variable explícita. Es lo que
 *    permite que los E2E prueben acceso, cambio de cuenta y cierre de sesión sin depender de
 *    Google ni de un proyecto real.
 *
 * El caso 3 no puede activarse en producción: `__DEV__` es falso en un bundle compilado, así
 * que la condición no se cumple aunque la variable esté puesta.
 */

/** Solo se consulta en desarrollo. Fuera de él, el valor da igual. */
function fakeRequested(): boolean {
  return __DEV__ && process.env.EXPO_PUBLIC_AUTH_FAKE === '1';
}

export function createAuthService(
  config: SupabaseConfigResult = readSupabaseConfig(),
): AuthService {
  if (fakeRequested()) {
    return createFakeAuthService({ storage: AsyncStorage });
  }

  if (!config.ok) {
    return createUnconfiguredAuthService(config.missing);
  }

  const client = createSupabaseClient(config.config);
  return createSupabaseAuthService({
    auth: client.auth,
    platform: createOAuthPlatform(),
    // Si el proyecto exige confirmar el correo, el enlace del mensaje debe volver a la
    // aplicación por el mismo sitio que el regreso de OAuth.
    emailRedirectTo: oauthRedirectTo(),
  });
}
