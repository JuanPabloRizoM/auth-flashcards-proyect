import { Stack } from 'expo-router';

import { AppShell } from '../../src/components/layout';
import { AuthBootstrap, AuthGate } from '../../src/lib/AuthGate';
import { useAuth } from '../../src/lib/AuthProvider';
import { UserScopedData } from '../../src/lib/UserScopedData';

/**
 * Zona privada.
 *
 * Todo lo que hay debajo exige sesión. El guard va primero: si no la hay, estas pantallas no
 * se montan siquiera.
 *
 * `key={user.id}` no es decorativo. Al cambiar de cuenta obliga a React a destruir los
 * proveedores de datos y a crearlos de nuevo con el espacio de nombres del usuario nuevo. Sin
 * esa clave, una escritura en vuelo del usuario anterior encontraría el proveedor vivo y
 * acabaría en el espacio del siguiente.
 */
export default function PrivateLayout() {
  const { user, signOut } = useAuth();

  return (
    <AuthGate>
      {user === null ? (
        // El guard ya redirige en este caso; esto solo cubre el instante entre el cambio de
        // estado y la navegación.
        <AuthBootstrap />
      ) : (
        <UserScopedData key={user.id} userId={user.id}>
          <AppShell account={{ email: user.email, onSignOut: signOut }}>
            <Stack screenOptions={{ headerShown: false }} />
          </AppShell>
        </UserScopedData>
      )}
    </AuthGate>
  );
}
