import { Stack } from 'expo-router';

import { AuthGate } from '../../src/lib/AuthGate';

/**
 * Zona pública: iniciar sesión, crear cuenta y el regreso de Google.
 *
 * El mismo guard que protege la zona privada hace aquí el trabajo simétrico: quien ya tiene
 * sesión no se queda en la pantalla de acceso, va a la aplicación.
 *
 * Estas pantallas no llevan `AppShell`: sin sesión no hay destinos que ofrecer.
 */
export default function PublicLayout() {
  return (
    <AuthGate>
      <Stack screenOptions={{ headerShown: false }} />
    </AuthGate>
  );
}
