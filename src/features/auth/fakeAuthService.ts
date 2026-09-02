import type {
  AuthOutcome,
  AuthService,
  AuthSession,
  GoogleOutcome,
  SignUpOutcome,
} from './types';
import { normalizeEmail } from './types';

/**
 * Doble de pruebas del contrato de autenticación.
 *
 * Existe para que los tests deterministas —unitarios, de integración y E2E— puedan ejercitar
 * el ciclo completo de acceso, cambio de cuenta y cierre de sesión **sin red, sin Google y
 * sin un proyecto Supabase**. Cumple exactamente el mismo contrato que la implementación
 * real, así que lo que estos tests demuestran es el comportamiento de la aplicación frente a
 * un servicio de autenticación; lo que **no** demuestran es la integración con Supabase, que
 * se verifica aparte (ver el contrato de TASK-008, `external_verification_required`).
 *
 * Guarda su estado en el mismo almacenamiento que el resto de la aplicación, para que un
 * test pueda recargar la página o desmontar el árbol y comprobar que la sesión se restaura.
 *
 * Nunca se activa en producción: `createAuthService` solo lo elige en desarrollo y con una
 * variable de entorno explícita (`src/features/auth/service.ts`).
 */

export const FAKE_AUTH_STORAGE_KEY = 'flashcards:auth:fake:v1';

/** Lo mínimo que el doble necesita de un almacenamiento de clave/valor. */
export type FakeAuthStore = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
};

type FakeAccount = {
  id: string;
  email: string;
  password: string;
  confirmed: boolean;
};

type FakeState = {
  accounts: FakeAccount[];
  counter: number;
  session: { userId: string; expiresAt: number } | null;
};

const emptyState: FakeState = { accounts: [], counter: 0, session: null };

export type FakeAuthOptions = {
  storage: FakeAuthStore;
  /** Cómo se comporta el proyecto simulado ante un alta: como Supabase con o sin confirmación. */
  emailConfirmation?: 'auto' | 'required';
  /** Qué hace el acceso con Google cuando se pulsa el botón. */
  google?: { outcome: 'exito' | 'cancelado' | 'fallo'; email?: string };
  now?: () => number;
  sessionTtlMs?: number;
};

/** El doble, más los contadores que algunos tests necesitan observar. */
export type FakeAuthService = AuthService & {
  readonly calls: { signIn: number; signUp: number; google: number; signOut: number };
};

function parseState(raw: string | null): FakeState {
  if (raw === null) return { ...emptyState, accounts: [] };
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null) return { ...emptyState, accounts: [] };
    const state = value as Partial<FakeState>;
    return {
      accounts: Array.isArray(state.accounts) ? (state.accounts as FakeAccount[]) : [],
      counter: typeof state.counter === 'number' ? state.counter : 0,
      session: state.session ?? null,
    };
  } catch {
    return { ...emptyState, accounts: [] };
  }
}

export type FakeAuthSeedAccount = {
  id: string;
  email: string;
  /** Vacía para las cuentas que solo entran con Google. */
  password?: string;
  confirmed?: boolean;
};

export type FakeAuthSeed = {
  accounts: readonly FakeAuthSeedAccount[];
  /** Identificador de la cuenta con sesión abierta, si alguna la tiene. */
  signedInAs?: string;
  /** Caducidad de esa sesión. Por defecto, muy lejos. */
  expiresAt?: number;
};

/**
 * Estado inicial del doble, serializado.
 *
 * Lo usan los tests que necesitan empezar ya autenticados —la mayoría, porque no van de
 * autenticación— y los E2E, que lo siembran en el almacenamiento del navegador antes de
 * cargar la aplicación. Está aquí, y no en cada test, para que el formato del doble siga
 * siendo un detalle suyo.
 */
export function fakeAuthState({ accounts, signedInAs, expiresAt }: FakeAuthSeed): string {
  const state: FakeState = {
    accounts: accounts.map((account) => ({
      id: account.id,
      email: account.email,
      password: account.password ?? '',
      confirmed: account.confirmed ?? true,
    })),
    counter: accounts.length,
    session:
      signedInAs === undefined
        ? null
        : { userId: signedInAs, expiresAt: expiresAt ?? Date.now() + 24 * 60 * 60 * 1000 },
  };
  return JSON.stringify(state);
}

export function createFakeAuthService({
  storage,
  emailConfirmation = 'auto',
  google = { outcome: 'exito' },
  now = Date.now,
  sessionTtlMs = 60 * 60 * 1000,
}: FakeAuthOptions): FakeAuthService {
  const listeners = new Set<(session: AuthSession | null) => void>();
  const calls = { signIn: 0, signUp: 0, google: 0, signOut: 0 };

  const read = async (): Promise<FakeState> => parseState(await storage.getItem(FAKE_AUTH_STORAGE_KEY));
  const write = async (state: FakeState): Promise<void> => {
    await storage.setItem(FAKE_AUTH_STORAGE_KEY, JSON.stringify(state));
  };

  const sessionOf = (state: FakeState): AuthSession | null => {
    if (state.session === null) return null;
    // Una sesión caducada es exactamente lo mismo que no tener sesión.
    if (state.session.expiresAt <= now()) return null;
    const account = state.accounts.find((candidate) => candidate.id === state.session?.userId);
    if (!account) return null;
    return {
      user: { id: account.id, email: account.email },
      expiresAt: state.session.expiresAt,
    };
  };

  const publish = (session: AuthSession | null): void => {
    for (const listener of listeners) listener(session);
  };

  const openSession = async (state: FakeState, account: FakeAccount): Promise<AuthSession> => {
    const next: FakeState = {
      ...state,
      session: { userId: account.id, expiresAt: now() + sessionTtlMs },
    };
    await write(next);
    const session = sessionOf(next);
    // `sessionOf` acaba de construirse a partir de un estado con sesión y con la cuenta
    // dentro, así que no puede ser nula; el aserto documenta la invariante.
    if (session === null) throw new Error('El doble de autenticación no ha podido abrir la sesión.');
    publish(session);
    return session;
  };

  return {
    calls,
    configured: true,
    missingConfiguration: [],

    async getSession(): Promise<AuthSession | null> {
      return sessionOf(await read());
    },

    onAuthStateChange(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    async signInWithEmail(email: string, password: string): Promise<AuthOutcome> {
      calls.signIn += 1;
      const state = await read();
      const wanted = normalizeEmail(email);
      const account = state.accounts.find((candidate) => candidate.email === wanted);
      if (!account || account.password !== password) {
        return { ok: false, error: 'credenciales-invalidas' };
      }
      if (!account.confirmed) {
        return { ok: false, error: 'verificacion-pendiente' };
      }
      return { ok: true, session: await openSession(state, account) };
    },

    async signUpWithEmail(email: string, password: string): Promise<SignUpOutcome> {
      calls.signUp += 1;
      const state = await read();
      const wanted = normalizeEmail(email);
      if (state.accounts.some((candidate) => candidate.email === wanted)) {
        return { ok: false, error: 'registro-rechazado' };
      }
      const counter = state.counter + 1;
      const account: FakeAccount = {
        id: `usuario-${counter}`,
        email: wanted,
        password,
        confirmed: emailConfirmation === 'auto',
      };
      const next: FakeState = { ...state, counter, accounts: [...state.accounts, account] };
      if (!account.confirmed) {
        await write(next);
        return { ok: true, session: null, verificationRequired: true };
      }
      return { ok: true, session: await openSession(next, account) };
    },

    async signInWithGoogle(): Promise<GoogleOutcome> {
      calls.google += 1;
      if (google.outcome === 'cancelado') {
        return { ok: false, error: 'oauth-cancelado' };
      }
      if (google.outcome === 'fallo') {
        return { ok: false, error: 'oauth-fallido' };
      }
      const state = await read();
      const wanted = google.email ?? 'cuenta.google@example.com';
      const existing = state.accounts.find((candidate) => candidate.email === wanted);
      if (existing) {
        return { ok: true, session: await openSession(state, existing) };
      }
      const counter = state.counter + 1;
      const account: FakeAccount = {
        id: `usuario-${counter}`,
        email: wanted,
        // El acceso con Google no tiene contraseña local: no hay nada que guardar.
        password: '',
        confirmed: true,
      };
      const next: FakeState = { ...state, counter, accounts: [...state.accounts, account] };
      return { ok: true, session: await openSession(next, account) };
    },

    async completeSessionFromUrl(): Promise<GoogleOutcome> {
      // El doble no simula deep links: quien llega aquí en un test lo hace por error, y
      // devolver un fallo controlado es más útil que fingir una sesión.
      return { ok: false, error: 'oauth-fallido' };
    },

    async signOut(): Promise<void> {
      calls.signOut += 1;
      const state = await read();
      // Las cuentas siguen ahí: cerrar sesión no borra nada (docs/PRODUCT.md, 2026-09-02).
      await write({ ...state, session: null });
      publish(null);
    },
  };
}
