import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { authErrorMessage } from '../features/auth/errors';
import type { AuthStatus } from '../features/auth/guard';
import { createAuthService } from '../features/auth/service';
import type {
  AuthErrorCode,
  AuthService,
  AuthSession,
  AuthUser,
  GoogleOutcome,
  SignUpOutcome,
} from '../features/auth/types';

/**
 * Estado central de la sesión.
 *
 * Es el único punto del árbol que habla con `AuthService`, igual que `LibraryProvider` es el
 * único que habla con `LibraryRepository`. Las pantallas solo usan `useAuth`.
 *
 * Tres estados y nada más: `loading` mientras se resuelve la sesión guardada, `authenticated`
 * y `unauthenticated`. El primero importa tanto como los otros dos: mientras dura, la
 * aplicación no puede pintar contenido privado ni mandar a nadie a la pantalla de acceso,
 * porque todavía no sabe cuál de las dos cosas es correcta.
 *
 * **Aquí no se guardan contraseñas ni tokens.** La contraseña vive en el estado del
 * formulario que la pide y desaparece con él; los tokens se quedan dentro de supabase-js.
 */

export type AuthActionResult = { ok: true } | { ok: false; message: string };

export type SignUpResult =
  | { ok: true; verificationRequired: false }
  | { ok: true; verificationRequired: true; message: string }
  | { ok: false; message: string };

export type GoogleResult =
  | { ok: true; pending: boolean }
  | { ok: false; cancelled: boolean; message: string };

export type AuthValue = {
  status: AuthStatus;
  user: AuthUser | null;
  session: AuthSession | null;
  /** `false` si faltan variables de entorno. La aplicación arranca igual. */
  configured: boolean;
  missingConfiguration: readonly string[];
  signIn: (email: string, password: string) => Promise<AuthActionResult>;
  signUp: (email: string, password: string) => Promise<SignUpResult>;
  signInWithGoogle: () => Promise<GoogleResult>;
  /**
   * Completa la sesión con el enlace por el que se ha abierto la aplicación.
   *
   * Solo hace falta en iOS y Android: en web la librería lee la URL al arrancar.
   */
  completeSessionFromUrl: (url: string) => Promise<AuthActionResult>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export type AuthProviderProps = {
  children: ReactNode;
  /** Inyectable para probar con otra implementación del mismo contrato. */
  service?: AuthService;
};

function messageFor(error: AuthErrorCode): string {
  return authErrorMessage(error);
}

export function AuthProvider({ children, service }: AuthProviderProps) {
  // Inicializador perezoso y no una referencia: el servicio se lee durante el renderizado
  // (`configured` decide qué enseña la pantalla de acceso) y se crea una sola vez.
  const [auth] = useState<AuthService>(() => service ?? createAuthService());

  const [session, setSession] = useState<AuthSession | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');

  useEffect(() => {
    let cancelled = false;

    // La suscripción se abre antes de leer la sesión guardada: si el servicio emite un
    // cambio mientras se resuelve la lectura, no se pierde.
    const unsubscribe = auth.onAuthStateChange((next) => {
      if (cancelled) return;
      setSession(next);
      setStatus(next === null ? 'unauthenticated' : 'authenticated');
    });

    void auth.getSession().then((restored) => {
      if (cancelled) return;
      setSession(restored);
      setStatus(restored === null ? 'unauthenticated' : 'authenticated');
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [auth]);

  const signIn = useCallback(
    async (email: string, password: string): Promise<AuthActionResult> => {
      const outcome = await auth.signInWithEmail(email, password);
      if (!outcome.ok) {
        return { ok: false, message: messageFor(outcome.error) };
      }
      // No se toca el estado a mano: la sesión llega por `onAuthStateChange`, que es la
      // misma vía por la que llegan la restauración y la caducidad. Un solo camino.
      return { ok: true };
    },
    [auth],
  );

  const signUp = useCallback(
    async (email: string, password: string): Promise<SignUpResult> => {
      const outcome: SignUpOutcome = await auth.signUpWithEmail(email, password);
      if (!outcome.ok) {
        return { ok: false, message: messageFor(outcome.error) };
      }
      if (outcome.session === null) {
        return {
          ok: true,
          verificationRequired: true,
          message: messageFor('verificacion-pendiente'),
        };
      }
      return { ok: true, verificationRequired: false };
    },
    [auth],
  );

  const signInWithGoogle = useCallback(async (): Promise<GoogleResult> => {
    const outcome: GoogleOutcome = await auth.signInWithGoogle();
    if (!outcome.ok) {
      return {
        ok: false,
        cancelled: outcome.error === 'oauth-cancelado',
        message: messageFor(outcome.error),
      };
    }
    return { ok: true, pending: outcome.session === null };
  }, [auth]);

  const completeSessionFromUrl = useCallback(
    async (url: string): Promise<AuthActionResult> => {
      const outcome = await auth.completeSessionFromUrl(url);
      if (!outcome.ok) {
        return { ok: false, message: messageFor(outcome.error) };
      }
      return { ok: true };
    },
    [auth],
  );

  const signOut = useCallback(async (): Promise<void> => {
    await auth.signOut();
    // Un servicio puede no emitir el cambio si la llamada remota falló. Cerrar sesión es una
    // decisión de quien la pulsa, no del servidor: el estado local se descarta igualmente.
    setSession(null);
    setStatus('unauthenticated');
  }, [auth]);

  const value = useMemo<AuthValue>(
    () => ({
      status,
      user: session?.user ?? null,
      session,
      configured: auth.configured,
      missingConfiguration: auth.missingConfiguration,
      signIn,
      signUp,
      signInWithGoogle,
      completeSessionFromUrl,
      signOut,
    }),
    [
      auth.configured,
      auth.missingConfiguration,
      completeSessionFromUrl,
      session,
      signIn,
      signInWithGoogle,
      signOut,
      signUp,
      status,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth debe usarse dentro de AuthProvider.');
  }
  return value;
}
