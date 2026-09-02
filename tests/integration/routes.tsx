import { Stack } from 'expo-router';
import type { ReactNode } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import PrivateLayout from '../../app/(app)/_layout';
import ComponentesScreen from '../../app/(app)/componentes';
import EstadisticasScreen from '../../app/(app)/estadisticas';
import MisMazosScreen from '../../app/(app)/index';
import EstudiarScreen from '../../app/(app)/mazo/[id]/estudiar';
import ImportarScreen from '../../app/(app)/mazo/[id]/importar';
import DetalleMazoScreen from '../../app/(app)/mazo/[id]/index';
import AuthCallbackScreen from '../../app/(auth)/auth/callback';
import PublicLayout from '../../app/(auth)/_layout';
import LoginScreen from '../../app/(auth)/login';
import RegistroScreen from '../../app/(auth)/registro';
import {
  createFakeAuthService,
  fakeAuthState,
  FAKE_AUTH_STORAGE_KEY,
} from '../../src/features/auth/fakeAuthService';
import type { AuthService } from '../../src/features/auth/types';
import { AuthProvider } from '../../src/lib/AuthProvider';

/**
 * Mapa de rutas reales compartido por los tests de integración.
 *
 * Reproduce el layout raíz de la aplicación —`SafeAreaProvider` + `AuthProvider` + `Stack`—
 * con una diferencia: el servicio de autenticación se inyecta. El de verdad se construye a
 * partir de variables de entorno y hablaría con Supabase; aquí interesa ejercitar la
 * aplicación contra el contrato de autenticación, no contra la red.
 *
 * Los grupos `(app)` y `(auth)` aparecen tal cual porque son archivos reales del proyecto:
 * los tests montan los mismos layouts que la aplicación, incluidos sus guards.
 */

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 1280, height: 900 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

let servicioInyectado: AuthService | null = null;
let enlaceDeCallback: string | null | undefined;

/** Fija el servicio de autenticación del próximo montaje. */
export function usarServicioDeAuth(service: AuthService): void {
  servicioInyectado = service;
}

/** Vuelve al doble por defecto, ya autenticado. Lo llama `beforeEach` del arnés. */
export function reiniciarServicioDeAuth(): void {
  servicioInyectado = null;
}

/**
 * Fija el enlace con el que se ha «abierto» la aplicación en el próximo montaje.
 *
 * Es el camino de iOS y Android: allí el enlace de confirmación de correo abre la aplicación
 * en frío y hay que leerlo. No se puede provocar de verdad desde un test, así que se inyecta.
 */
export function usarEnlaceDeCallback(url: string | null | undefined): void {
  enlaceDeCallback = url;
}

/** La cuenta con la que arrancan los tests que no van de autenticación. */
export const USUARIO_DE_LAS_RUTAS = { id: 'usuario-prueba', email: 'prueba@example.com' };

/** Un doble en memoria, opcionalmente con estado inicial. */
export function servicioEnMemoria(estadoInicial?: string): AuthService {
  const memoria = new Map<string, string>();
  if (estadoInicial !== undefined) {
    memoria.set(FAKE_AUTH_STORAGE_KEY, estadoInicial);
  }
  return createFakeAuthService({
    storage: {
      getItem: async (key) => memoria.get(key) ?? null,
      setItem: async (key, value) => {
        memoria.set(key, value);
      },
    },
  });
}

function servicioPorDefecto(): AuthService {
  // Ya autenticado: el guard es real y estas pruebas no van de acceso, pero tampoco pueden
  // saltárselo. El identificador es fijo para que las claves del almacenamiento lo sean.
  return servicioEnMemoria(
    fakeAuthState({
      accounts: [{ ...USUARIO_DE_LAS_RUTAS, password: 'contraseña-de-prueba' }],
      signedInAs: USUARIO_DE_LAS_RUTAS.id,
    }),
  );
}

export function TestRootLayout({ children }: { children?: ReactNode }) {
  servicioInyectado ??= servicioPorDefecto();
  return (
    <SafeAreaProvider initialMetrics={metrics}>
      <AuthProvider service={servicioInyectado}>
        {children ?? <Stack screenOptions={{ headerShown: false }} />}
      </AuthProvider>
    </SafeAreaProvider>
  );
}

export const routes = {
  _layout: TestRootLayout,
  '(app)/_layout': PrivateLayout,
  '(app)/index': MisMazosScreen,
  '(app)/componentes': ComponentesScreen,
  '(app)/estadisticas': EstadisticasScreen,
  '(app)/mazo/[id]/index': DetalleMazoScreen,
  '(app)/mazo/[id]/estudiar': EstudiarScreen,
  '(app)/mazo/[id]/importar': ImportarScreen,
  '(auth)/_layout': PublicLayout,
  '(auth)/login': LoginScreen,
  '(auth)/registro': RegistroScreen,
  '(auth)/auth/callback': () => <AuthCallbackScreen linkUrl={enlaceDeCallback} />,
};
