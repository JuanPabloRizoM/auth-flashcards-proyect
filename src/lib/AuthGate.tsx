import { usePathname, useRouter } from 'expo-router';
import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Loading } from '../components/ui';
import { decideRoute } from '../features/auth/guard';
import { colors, spacing } from '../theme';

import { useAuth } from './AuthProvider';

/**
 * Guardia de rutas.
 *
 * Decide con `decideRoute`, que es pura y está probada aparte:
 *
 * ```text
 * loading                    → esperar   (indicador de carga; nada de la aplicación)
 * sin sesión + ruta pública  → mostrar
 * sin sesión + ruta privada  → /login
 * con sesión + ruta pública  → /
 * con sesión + ruta privada  → mostrar
 * ```
 *
 * Vive en el layout de cada grupo de rutas, no en el raíz, que es lo que permite **no
 * renderizar los hijos** mientras redirige. Si se renderizaran, la pantalla privada se
 * pintaría durante un fotograma antes de que la navegación surtiera efecto: el destello de
 * contenido privado que hay que evitar.
 *
 * La navegación va en un efecto y no durante el renderizado. Navegar mientras se pinta
 * compite con el propio montaje del navegador: cuando la sesión aparece dentro del primer
 * efecto de una pantalla —el caso del enlace de confirmación de correo, que abre la
 * aplicación en frío sobre `/auth/callback`— las dos actualizaciones se persiguen y React
 * corta por exceso de profundidad. Desde un efecto, la redirección ocurre con el árbol ya
 * confirmado. Que los hijos no se rendericen sigue siendo lo que evita el destello: el
 * momento de navegar no cambia lo que se ve.
 */

export type AuthGateProps = {
  children: ReactNode;
};

export function AuthGate({ children }: AuthGateProps) {
  const { status } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const decision = decideRoute(status, pathname);
  const destino = decision.action === 'redirigir' ? decision.to : null;

  useEffect(() => {
    if (destino === null) return;
    router.replace(destino);
  }, [destino, router]);

  if (decision.action !== 'mostrar') {
    return <AuthBootstrap />;
  }
  return <>{children}</>;
}

/** Lo único que se ve mientras la sesión guardada se resuelve. */
export function AuthBootstrap() {
  return (
    <View style={styles.root} testID="auth-bootstrap">
      <Loading message="Cargando tu sesión…" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },
});
