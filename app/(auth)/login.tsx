import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { AuthFooter, AuthQuestion, AuthScreen, AuthSeparator } from '../../src/components/auth';
import { Button, Input, Message } from '../../src/components/ui';
import { useAuth } from '../../src/lib/AuthProvider';
import { colors, sizes, spacing, typography } from '../../src/theme';

/**
 * Iniciar sesión.
 *
 * Ruta pública. Dos caminos hacia la misma sesión: correo y contraseña, o Google. El botón
 * de Google llama exactamente a la misma operación que el de la pantalla de registro; no
 * existen dos flujos de OAuth (docs/PRODUCT.md, 2026-09-02).
 *
 * El error de credenciales es siempre el mismo mensaje, escrito aquí y no traído del
 * proveedor: distinguir "esa dirección no existe" de "esa contraseña no es" convertiría esta
 * pantalla en un comprobador de qué correos están registrados.
 */
export default function LoginScreen() {
  const router = useRouter();
  const { signIn, signInWithGoogle, configured, missingConfiguration } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState<'ninguno' | 'correo' | 'google'>('ninguno');
  const [error, setError] = useState<string | undefined>(undefined);
  const [fieldError, setFieldError] = useState<{ email?: string; password?: string }>({});

  const busy = pending !== 'ninguno';

  const submit = async () => {
    // La guarda no está solo en el `disabled` del botón: entre la pulsación y el repintado
    // caben dos eventos, y un doble clic no puede producir dos intentos de acceso.
    if (busy) return;

    const faltaEmail = email.trim() === '';
    const faltaPassword = password === '';
    if (faltaEmail || faltaPassword) {
      setFieldError({
        email: faltaEmail ? 'Escribe tu correo electrónico.' : undefined,
        password: faltaPassword ? 'Escribe tu contraseña.' : undefined,
      });
      return;
    }

    setFieldError({});
    setError(undefined);
    setPending('correo');
    const result = await signIn(email, password);
    if (!result.ok) {
      setError(result.message);
      setPending('ninguno');
      return;
    }
    // Con sesión válida el guard del layout lleva a la aplicación; no hace falta navegar
    // aquí, y hacerlo competiría con él.
    setPending('ninguno');
  };

  const withGoogle = async () => {
    if (busy) return;
    setError(undefined);
    setPending('google');
    const result = await signInWithGoogle();
    if (!result.ok) {
      // Cancelar no es un fallo: se informa sin alarmar y la pantalla queda utilizable.
      setError(result.message);
    }
    if (!result.ok || !result.pending) {
      setPending('ninguno');
    }
  };

  return (
    <AuthScreen testID="login-screen" title="Iniciar sesión">
      {!configured ? (
        <Message testID="login-sin-configuracion" variant="error">
          {`El acceso no está configurado en esta instalación. Faltan estas variables de entorno: ${missingConfiguration.join(', ')}.`}
        </Message>
      ) : null}

      <Input
        autoCapitalize="none"
        autoComplete="email"
        autoCorrect={false}
        error={fieldError.email}
        keyboardType="email-address"
        label="Correo electrónico"
        onChangeText={setEmail}
        placeholder="correo@ejemplo.com"
        testID="login-email"
        textContentType="emailAddress"
        value={email}
      />

      <Input
        autoCapitalize="none"
        autoComplete="current-password"
        autoCorrect={false}
        error={fieldError.password}
        label="Contraseña"
        onChangeText={setPassword}
        onSubmitEditing={() => void submit()}
        returnKeyType="go"
        secureTextEntry
        testID="login-password"
        textContentType="password"
        value={password}
      />

      {error ? (
        <Message testID="login-error" variant="error">
          {error}
        </Message>
      ) : null}

      <Button
        disabled={busy}
        label="Iniciar sesión"
        loading={pending === 'correo'}
        onPress={() => void submit()}
        testID="login-submit"
      />

      <AuthSeparator />

      <Button
        disabled={busy}
        label="Continuar con Google"
        loading={pending === 'google'}
        onPress={() => void withGoogle()}
        testID="login-google"
        variant="secondary"
      />

      <AuthFooter>
        <AuthQuestion>¿No tienes una cuenta?</AuthQuestion>
        <Pressable
          accessibilityRole="link"
          onPress={() => router.replace('/registro')}
          style={styles.link}
          testID="login-ir-a-registro"
        >
          <Text style={styles.linkLabel}>Registrarse</Text>
        </Pressable>
      </AuthFooter>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  link: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: sizes.touchTarget,
    paddingHorizontal: spacing.md,
  },
  linkLabel: {
    color: colors.primary,
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
  },
});
