import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';

import type {
  AuthOutcome,
  AuthService,
  AuthSession,
  GoogleOutcome,
  SignUpOutcome,
} from '../../src/features/auth/types';

import { routes, usarServicioDeAuth } from './routes';

/**
 * Arnés de los tests de autenticación.
 *
 * Monta la aplicación real —los mismos layouts, los mismos guards y las mismas pantallas—
 * con el servicio de autenticación inyectado. Lo que se ejercita es el comportamiento de la
 * aplicación frente al contrato `AuthService`; la integración con Supabase se verifica aparte.
 */

export function montarConAuth(service: AuthService, initialUrl = '/') {
  usarServicioDeAuth(service);
  return renderRouter(routes, { initialUrl });
}

export type ServicioProgramable = AuthService & {
  /** Cuántas veces se ha llamado a cada operación. */
  readonly calls: {
    signIn: number;
    signUp: number;
    google: number;
    completeFromUrl: number;
    signOut: number;
  };
  /** Resuelve el inicio de sesión pendiente. */
  resolverSignIn: (outcome: AuthOutcome) => void;
  /** Emite un cambio de sesión, como haría el proveedor. */
  emitir: (session: AuthSession | null) => void;
};

export const SESION_DE_PRUEBA: AuthSession = {
  user: { id: 'usuario-a', email: 'ana@example.com' },
  expiresAt: Date.now() + 60 * 60 * 1000,
};

export type ServicioProgramableOptions = {
  /** Sesión que devuelve `getSession` al arrancar. */
  sesionInicial?: AuthSession | null;
  /** Deja `getSession` sin resolver, para observar el arranque. */
  arranqueColgado?: boolean;
  /** Deja `signInWithEmail` sin resolver hasta que se llame a `resolverSignIn`. */
  signInColgado?: boolean;
  signIn?: AuthOutcome;
  signUp?: SignUpOutcome;
  google?: GoogleOutcome;
  completeFromUrl?: GoogleOutcome;
};

/**
 * Un servicio que hace exactamente lo que el test necesita y cuenta lo que le piden.
 *
 * El doble de `src/features/auth/fakeAuthService.ts` simula un proveedor completo; este otro
 * existe para poder dejar una operación colgada a propósito y observar el estado de carga, o
 * para contar llamadas.
 */
export function servicioProgramable(
  options: ServicioProgramableOptions = {},
): ServicioProgramable {
  const calls = { signIn: 0, signUp: 0, google: 0, completeFromUrl: 0, signOut: 0 };
  const listeners = new Set<(session: AuthSession | null) => void>();
  let resolverPendiente: ((outcome: AuthOutcome) => void) | null = null;

  const emitir = (session: AuthSession | null) => {
    for (const listener of listeners) listener(session);
  };

  return {
    calls,
    configured: true,
    missingConfiguration: [],
    resolverSignIn: (outcome) => {
      resolverPendiente?.(outcome);
      resolverPendiente = null;
    },
    emitir,

    getSession: () =>
      options.arranqueColgado === true
        ? new Promise<AuthSession | null>(() => undefined)
        : Promise.resolve(options.sesionInicial ?? null),

    onAuthStateChange: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    signInWithEmail: async (): Promise<AuthOutcome> => {
      calls.signIn += 1;
      if (options.signInColgado === true) {
        return new Promise<AuthOutcome>((resolve) => {
          resolverPendiente = resolve;
        });
      }
      const outcome = options.signIn ?? { ok: true, session: SESION_DE_PRUEBA };
      if (outcome.ok) emitir(outcome.session);
      return outcome;
    },

    signUpWithEmail: async (): Promise<SignUpOutcome> => {
      calls.signUp += 1;
      const outcome = options.signUp ?? { ok: true, session: SESION_DE_PRUEBA };
      if (outcome.ok && outcome.session !== null) emitir(outcome.session);
      return outcome;
    },

    signInWithGoogle: async (): Promise<GoogleOutcome> => {
      calls.google += 1;
      const outcome = options.google ?? { ok: true, session: SESION_DE_PRUEBA };
      if (outcome.ok && outcome.session !== null) emitir(outcome.session);
      return outcome;
    },

    completeSessionFromUrl: async (): Promise<GoogleOutcome> => {
      calls.completeFromUrl += 1;
      const outcome = options.completeFromUrl ?? { ok: false, error: 'oauth-fallido' as const };
      if (outcome.ok && outcome.session !== null) emitir(outcome.session);
      return outcome;
    },

    signOut: async () => {
      calls.signOut += 1;
      emitir(null);
    },
  };
}

// ── Acciones sobre la interfaz ────────────────────────────────────────────────

export async function escribirCredenciales(email: string, password: string) {
  fireEvent.changeText(screen.getByTestId('login-email'), email);
  fireEvent.changeText(screen.getByTestId('login-password'), password);
}

export async function pulsar(testID: string) {
  await act(async () => {
    fireEvent.press(screen.getByTestId(testID));
  });
}

/** Pulsa sin esperar a que las promesas se vacíen: para observar el estado de carga. */
export function pulsarSinEsperar(testID: string) {
  fireEvent.press(screen.getByTestId(testID));
}

export async function vaciarCola() {
  await act(async () => {
    await Promise.resolve();
  });
}
