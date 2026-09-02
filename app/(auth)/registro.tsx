import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { AuthFooter, AuthQuestion, AuthScreen, AuthSeparator } from '../../src/components/auth';
import { Button, Input, Message } from '../../src/components/ui';
import { useAuth } from '../../src/lib/AuthProvider';
import { colors, sizes, spacing, typography } from '../../src/theme';

/**
 * Crear cuenta.
 *
 * Ruta pública, con dos vistas y una sola ruta. La primera ofrece las dos maneras de crear
 * cuenta; el formulario de correo aparece al elegir la primera. Es estado interno y no otra
 * ruta porque no hay nada que enlazar ni compartir del formulario: separarlas obligaría a
 * mantener dos pantallas y un historial de navegación intermedio sin ganar nada.
 *
 * El botón de Google es el mismo flujo que en /login. Si la cuenta de Google no existía,
 * entra como cuenta nueva; si existía, entra a la suya. No hay vinculación manual de cuentas
 * en esta task.
 */
export default function RegistroScreen() {
  const router = useRouter();
  const { signUp, signInWithGoogle, configured, missingConfiguration } = useAuth();

  const [vista, setVista] = useState<'opciones' | 'correo'>('opciones');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [pending, setPending] = useState<'ninguno' | 'correo' | 'google'>('ninguno');
  const [error, setError] = useState<string | undefined>(undefined);
  const [aviso, setAviso] = useState<string | undefined>(undefined);
  const [fieldError, setFieldError] = useState<{
    email?: string;
    password?: string;
    confirmacion?: string;
  }>({});

  const busy = pending !== 'ninguno';

  const crearCuenta = async () => {
    if (busy) return;

    const faltaEmail = email.trim() === '';
    const faltaPassword = password === '';
    const faltaConfirmacion = confirmacion === '';
    const noCoinciden = !faltaPassword && !faltaConfirmacion && password !== confirmacion;

    if (faltaEmail || faltaPassword || faltaConfirmacion || noCoinciden) {
      setFieldError({
        email: faltaEmail ? 'Escribe tu correo electrónico.' : undefined,
        password: faltaPassword ? 'Escribe una contraseña.' : undefined,
        confirmacion: faltaConfirmacion
          ? 'Repite la contraseña.'
          : noCoinciden
            ? 'Las dos contraseñas no coinciden.'
            : undefined,
      });
      return;
    }

    setFieldError({});
    setError(undefined);
    setAviso(undefined);
    setPending('correo');

    const result = await signUp(email, password);
    setPending('ninguno');

    if (!result.ok) {
      setError(result.message);
      return;
    }
    if (result.verificationRequired) {
      // Supabase ha creado el usuario pero todavía no hay sesión. No se finge ninguna.
      setAviso(result.message);
      setPassword('');
      setConfirmacion('');
      return;
    }
    // Con sesión inmediata, el guard del layout lleva a la aplicación.
  };

  const withGoogle = async () => {
    if (busy) return;
    setError(undefined);
    setAviso(undefined);
    setPending('google');
    const result = await signInWithGoogle();
    if (!result.ok) {
      setError(result.message);
    }
    if (!result.ok || !result.pending) {
      setPending('ninguno');
    }
  };

  const sinConfigurar = !configured ? (
    <Message testID="registro-sin-configuracion" variant="error">
      {`El acceso no está configurado en esta instalación. Faltan estas variables de entorno: ${missingConfiguration.join(', ')}.`}
    </Message>
  ) : null;

  const irALogin = (
    <AuthFooter>
      <AuthQuestion>¿Ya tienes una cuenta?</AuthQuestion>
      <Pressable
        accessibilityRole="link"
        onPress={() => router.replace('/login')}
        style={styles.link}
        testID="registro-ir-a-login"
      >
        <Text style={styles.linkLabel}>Iniciar sesión</Text>
      </Pressable>
    </AuthFooter>
  );

  if (vista === 'opciones') {
    return (
      <AuthScreen testID="registro-screen" title="Crear cuenta">
        {sinConfigurar}
        {error ? (
          <Message testID="registro-error" variant="error">
            {error}
          </Message>
        ) : null}

        <Button
          disabled={busy}
          label="Registrarse con correo electrónico"
          onPress={() => setVista('correo')}
          testID="registro-con-correo"
        />

        <AuthSeparator />

        <Button
          disabled={busy}
          label="Continuar con Google"
          loading={pending === 'google'}
          onPress={() => void withGoogle()}
          testID="registro-google"
          variant="secondary"
        />

        {irALogin}
      </AuthScreen>
    );
  }

  return (
    <AuthScreen testID="registro-screen-correo" title="Crear cuenta">
      {sinConfigurar}

      <Input
        autoCapitalize="none"
        autoComplete="email"
        autoCorrect={false}
        error={fieldError.email}
        keyboardType="email-address"
        label="Correo electrónico"
        onChangeText={setEmail}
        placeholder="correo@ejemplo.com"
        testID="registro-email"
        textContentType="emailAddress"
        value={email}
      />

      <Input
        autoCapitalize="none"
        autoComplete="new-password"
        autoCorrect={false}
        error={fieldError.password}
        label="Contraseña"
        onChangeText={setPassword}
        secureTextEntry
        testID="registro-password"
        textContentType="newPassword"
        value={password}
      />

      <Input
        autoCapitalize="none"
        autoComplete="new-password"
        autoCorrect={false}
        error={fieldError.confirmacion}
        label="Confirmar contraseña"
        onChangeText={setConfirmacion}
        onSubmitEditing={() => void crearCuenta()}
        returnKeyType="go"
        secureTextEntry
        testID="registro-password-confirm"
        textContentType="newPassword"
        value={confirmacion}
      />

      {error ? (
        <Message testID="registro-error" variant="error">
          {error}
        </Message>
      ) : null}

      {aviso ? (
        <Message testID="registro-verificacion" variant="info">
          {aviso}
        </Message>
      ) : null}

      <Button
        disabled={busy}
        label="Crear cuenta"
        loading={pending === 'correo'}
        onPress={() => void crearCuenta()}
        testID="registro-submit"
      />

      <Button
        disabled={busy}
        label="Volver"
        onPress={() => {
          setVista('opciones');
          setError(undefined);
          setAviso(undefined);
          setFieldError({});
        }}
        testID="registro-volver"
        variant="ghost"
      />

      {irALogin}
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
