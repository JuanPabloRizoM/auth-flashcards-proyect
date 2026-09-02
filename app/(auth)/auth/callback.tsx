import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { AuthScreen } from '../../../src/components/auth';
import { Button, Loading, Message } from '../../../src/components/ui';
import { cleanAuthUrl, oauthErrorIn } from '../../../src/features/auth/supabase/callbackUrl';
import { useAuth } from '../../../src/lib/AuthProvider';
import { spacing } from '../../../src/theme';

// Cierra la ventana de autenticación cuando el proveedor devuelve el control al navegador.
WebBrowser.maybeCompleteAuthSession();

/**
 * Regreso del proveedor.
 *
 * Ruta pública, porque quien llega aquí todavía no tiene sesión: es justo lo que se está
 * resolviendo. Llega por dos caminos, y no funcionan igual:
 *
 * - **Web**: `detectSessionInUrl` de supabase-js lee los datos de la URL al arrancar el
 *   cliente y crea la sesión. Aquí solo hay que retirar los tokens de la barra de
 *   direcciones, donde no pintan nada: se quedan en el historial y se copian con el enlace.
 * - **iOS y Android**: el cliente nativo no mira la URL, así que hay que leer el enlace por
 *   el que se ha abierto la aplicación y pedirle al servicio que lo convierta en sesión. Es
 *   el camino del enlace de confirmación de correo.
 *
 * En cuanto hay sesión, el guard del grupo lleva a la aplicación. Y pase lo que pase hay una
 * salida visible: esta pantalla no puede quedarse girando para siempre.
 */

/** El error que el proveedor haya dejado en la URL, leído una sola vez al montar. */
function errorEnLaUrl(): string | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  return oauthErrorIn(window.location.href) === null
    ? null
    : 'No hemos podido completar el acceso con Google.';
}

export type AuthCallbackScreenProps = {
  /**
   * Enlace por el que se ha abierto la aplicación.
   *
   * Inyectable para poder probar el camino nativo: el del sistema depende del enlace real
   * que abrió el proceso, y no hay manera de provocarlo desde un test.
   */
  linkUrl?: string | null;
};

export default function AuthCallbackScreen({ linkUrl }: AuthCallbackScreenProps = {}) {
  const router = useRouter();
  const { completeSessionFromUrl } = useAuth();
  const enlaceDelSistema = Linking.useLinkingURL();
  const enlace = linkUrl === undefined ? enlaceDelSistema : linkUrl;
  const [error, setError] = useState<string | null>(errorEnLaUrl);
  /**
   * Un enlace se canjea una sola vez.
   *
   * Los tokens de un redirect son de un solo uso, y en cuanto crean sesión el guard mueve la
   * pantalla de sitio. Sin esta marca, un renderizado extra durante esa transición volvería a
   * pedir la misma sesión.
   */
  const procesado = useRef<string | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const href = window.location.href;
    const limpia = cleanAuthUrl(href);
    if (limpia !== href) {
      // `replaceState` no recarga ni añade entrada al historial: la URL con tokens
      // simplemente deja de existir, también para el botón "atrás".
      window.history.replaceState(null, '', limpia);
    }
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web' || enlace === null) return;
    if (procesado.current === enlace) return;
    procesado.current = enlace;

    let cancelado = false;
    void completeSessionFromUrl(enlace).then((resultado) => {
      if (cancelado || resultado.ok) return;
      setError('Este enlace ya no sirve para iniciar sesión. Vuelve a intentarlo.');
    });

    return () => {
      cancelado = true;
    };
  }, [completeSessionFromUrl, enlace]);

  return (
    <AuthScreen testID="auth-callback-screen" title="Completando el acceso">
      {error === null ? (
        <View style={styles.centered} testID="auth-callback-esperando">
          <Loading message="Estamos terminando de iniciar tu sesión…" />
        </View>
      ) : (
        <Message testID="auth-callback-error" variant="error">
          {error}
        </Message>
      )}

      {/* Siempre visible: si el enlace no sirve, o no llega, tiene que haber salida. */}
      <Button
        label="Volver a iniciar sesión"
        onPress={() => router.replace('/login')}
        testID="auth-callback-volver"
        variant={error === null ? 'ghost' : 'primary'}
      />
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  centered: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
});
