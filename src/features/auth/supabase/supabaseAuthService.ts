import { mapSupabaseAuthError } from '../errors';
import type {
  AuthOutcome,
  AuthService,
  AuthSession,
  GoogleOutcome,
  SignUpOutcome,
} from '../types';
import { normalizeEmail } from '../types';

import type { SupabaseAuthApi, SupabaseSessionLike } from './authApi';
import {
  sessionFromRedirectUrl,
  signInWithGoogle,
  type OAuthPlatform,
} from './googleOAuth';

/**
 * Implementación del contrato propio sobre Supabase Auth.
 *
 * Es el único lugar del proyecto que traduce entre el dominio y la librería: qué forma tiene
 * una sesión, qué significa cada error y qué API se llama para cada operación. Cambiar de
 * proveedor de identidad se reduciría a escribir otro archivo como este.
 *
 * Recibe el cliente ya construido en vez de construirlo: así los tests pueden ejercitar el
 * adaptador contra un cliente simulado, sin red y sin proyecto.
 */

/** Traduce la sesión de la librería a la del dominio. Los tokens se quedan en la librería. */
export function toAuthSession(session: SupabaseSessionLike | null): AuthSession | null {
  const user = session?.user;
  if (!session || !user) return null;
  return {
    user: { id: user.id, email: user.email ?? null },
    // Supabase da la caducidad en segundos; el dominio trabaja en milisegundos.
    expiresAt: typeof session.expires_at === 'number' ? session.expires_at * 1000 : null,
  };
}

export type SupabaseAuthServiceOptions = {
  auth: SupabaseAuthApi;
  platform: OAuthPlatform;
  /** A dónde debe volver el enlace de confirmación de correo, si el proyecto lo exige. */
  emailRedirectTo?: string;
};

export function createSupabaseAuthService({
  auth,
  platform,
  emailRedirectTo,
}: SupabaseAuthServiceOptions): AuthService {
  const googleOutcome = (session: SupabaseSessionLike | null): GoogleOutcome => {
    const mapped = toAuthSession(session);
    return mapped === null ? { ok: false, error: 'oauth-fallido' } : { ok: true, session: mapped };
  };

  return {
    configured: true,
    missingConfiguration: [],

    async getSession(): Promise<AuthSession | null> {
      try {
        const { data, error } = await auth.getSession();
        if (error) return null;
        return toAuthSession(data.session);
      } catch {
        // Sin sesión legible se entra como no autenticado. Nunca se inventa una.
        return null;
      }
    },

    onAuthStateChange(listener) {
      const { data } = auth.onAuthStateChange((_event, session) => {
        listener(toAuthSession(session));
      });
      return () => {
        data.subscription.unsubscribe();
      };
    },

    async signInWithEmail(email: string, password: string): Promise<AuthOutcome> {
      try {
        const { data, error } = await auth.signInWithPassword({
          email: normalizeEmail(email),
          password,
        });
        if (error) {
          return { ok: false, error: mapSupabaseAuthError(error) };
        }
        const session = toAuthSession(data.session);
        if (session === null) {
          return { ok: false, error: 'credenciales-invalidas' };
        }
        return { ok: true, session };
      } catch (error) {
        return { ok: false, error: mapSupabaseAuthError(error) };
      }
    },

    async signUpWithEmail(email: string, password: string): Promise<SignUpOutcome> {
      try {
        const { data, error } = await auth.signUp({
          email: normalizeEmail(email),
          password,
          ...(emailRedirectTo === undefined ? {} : { options: { emailRedirectTo } }),
        });
        if (error) {
          return { ok: false, error: mapSupabaseAuthError(error) };
        }
        const session = toAuthSession(data.session);
        if (session !== null) {
          // El proyecto autoconfirma: hay sesión desde el primer momento.
          return { ok: true, session };
        }
        if (data.user) {
          // El proyecto exige confirmar el correo. El usuario existe, la sesión no.
          return { ok: true, session: null, verificationRequired: true };
        }
        return { ok: false, error: 'registro-rechazado' };
      } catch (error) {
        return { ok: false, error: mapSupabaseAuthError(error) };
      }
    },

    signInWithGoogle(): Promise<GoogleOutcome> {
      return signInWithGoogle(auth, platform, googleOutcome);
    },

    completeSessionFromUrl(url: string): Promise<GoogleOutcome> {
      return sessionFromRedirectUrl(auth, platform, url, googleOutcome);
    },

    async signOut(): Promise<void> {
      try {
        await auth.signOut();
      } catch {
        // Si el servicio no responde, la sesión local se descarta igualmente: quien pulsa
        // "Cerrar sesión" no puede quedarse dentro porque la red haya fallado.
      }
    },
  };
}

/** Servicio para cuando falta configuración: no autentica, no rompe y no inventa sesión. */
export function createUnconfiguredAuthService(missing: readonly string[]): AuthService {
  const rejected = { ok: false as const, error: 'sin-configuracion' as const };
  return {
    configured: false,
    missingConfiguration: missing,
    getSession: async () => null,
    onAuthStateChange: () => () => undefined,
    signInWithEmail: async () => rejected,
    signUpWithEmail: async () => rejected,
    signInWithGoogle: async () => rejected,
    completeSessionFromUrl: async () => rejected,
    signOut: async () => undefined,
  };
}
