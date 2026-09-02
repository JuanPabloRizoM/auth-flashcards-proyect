import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from '../src/lib/AuthProvider';

/**
 * Layout raíz.
 *
 * Monta el navegador y el estado de sesión, y nada más. Las dos zonas de la aplicación viven
 * en grupos de rutas con su propio layout, que es lo que permite que cada una decida si se
 * puede mostrar y que la otra **no llegue a montarse**:
 *
 * ```text
 * app/
 *   _layout.tsx        AuthProvider + Stack
 *   (auth)/            público:  /login, /registro, /auth/callback
 *   (app)/             privado:  /, /estadisticas, /componentes, /mazo/…
 * ```
 *
 * Los paréntesis del nombre no aparecen en la URL: las rutas siguen siendo exactamente las
 * mismas que antes de TASK-008.
 *
 * Los proveedores de datos (biblioteca e historial) ya no están aquí: dependen de quién ha
 * iniciado sesión, así que viven dentro del grupo privado (`src/lib/UserScopedData.tsx`).
 */
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </AuthProvider>
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}
