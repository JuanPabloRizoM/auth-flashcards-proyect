import type { GoogleOutcome } from '../types';

import type { SupabaseAuthApi, SupabaseSessionLike } from './authApi';

/**
 * Acceso con Google, con la mecánica que cada plataforma necesita.
 *
 * El flujo lo conduce Supabase: la aplicación no construye URLs de Google, no maneja el
 * `client_secret`, no genera ni valida `state` y no implementa PKCE. Solo pide la URL de
 * autorización, lleva a la persona hasta ella y devuelve el resultado.
 *
 * ```text
 *  web                                   iOS / Android
 *  ───                                   ─────────────
 *  signInWithOAuth(redirectTo)           signInWithOAuth(redirectTo, skipBrowserRedirect)
 *          │                                     │
 *  el navegador se va a Google           openAuthSessionAsync(url, redirectTo)
 *          │                                     │
 *  vuelve a /auth/callback               vuelve por el deep link flashcards://
 *          │                                     │
 *  detectSessionInUrl crea la sesión     setSession / exchangeCodeForSession
 * ```
 *
 * Las dos ramas viven aquí, juntas y con las dependencias inyectadas, porque son la misma
 * operación de dominio con dos mecánicas: separarlas en dos archivos por plataforma
 * duplicaría el mapeo de errores y el contrato de salida sin ganar nada.
 */

/** Lo que la mecánica de cada plataforma aporta al flujo. */
export type OAuthPlatform = {
  /** En web el propio navegador hace el viaje; en nativo lo hace una sesión de navegador. */
  isWeb: boolean;
  /** A dónde debe volver el proveedor. Debe estar registrada en el panel de Supabase. */
  redirectTo: string;
  /** Abre la sesión de navegador del sistema y espera al regreso. Solo se usa en nativo. */
  openAuthSession: (
    url: string,
    redirectTo: string,
  ) => Promise<{ type: string; url?: string | null }>;
  /** Extrae los parámetros del enlace de vuelta. */
  getQueryParams: (url: string) => {
    params: Record<string, string | undefined>;
    errorCode?: string | null;
  };
};

function sessionOrFailure(
  result: { data: { session: SupabaseSessionLike | null }; error: unknown },
  toSession: (session: SupabaseSessionLike | null) => GoogleOutcome,
): GoogleOutcome {
  if (result.error) {
    return { ok: false, error: 'oauth-fallido' };
  }
  return toSession(result.data.session);
}

/**
 * Convierte un enlace de vuelta en una sesión.
 *
 * Sirve para los dos caminos que llegan por deep link en iOS y Android: el regreso de Google
 * y el enlace de confirmación de correo. Es la misma lectura en los dos casos —tokens en la
 * URL, o un código si el proyecto usa PKCE— así que vive en un solo sitio.
 */
export async function sessionFromRedirectUrl(
  auth: SupabaseAuthApi,
  platform: OAuthPlatform,
  url: string,
  toOutcome: (session: SupabaseSessionLike | null) => GoogleOutcome,
): Promise<GoogleOutcome> {
  let leido;
  try {
    leido = platform.getQueryParams(url);
  } catch {
    return { ok: false, error: 'oauth-fallido' };
  }

  const { params, errorCode } = leido;
  if (errorCode || params.error) {
    return { ok: false, error: 'oauth-fallido' };
  }

  const accessToken = params.access_token;
  const refreshToken = params.refresh_token;
  if (accessToken && refreshToken) {
    try {
      return sessionOrFailure(
        await auth.setSession({ access_token: accessToken, refresh_token: refreshToken }),
        toOutcome,
      );
    } catch {
      return { ok: false, error: 'oauth-fallido' };
    }
  }

  // Los proyectos configurados con PKCE devuelven un código en vez de los tokens.
  const code = params.code;
  if (code) {
    try {
      return sessionOrFailure(await auth.exchangeCodeForSession(code), toOutcome);
    } catch {
      return { ok: false, error: 'oauth-fallido' };
    }
  }

  return { ok: false, error: 'oauth-fallido' };
}

export async function signInWithGoogle(
  auth: SupabaseAuthApi,
  platform: OAuthPlatform,
  toOutcome: (session: SupabaseSessionLike | null) => GoogleOutcome,
): Promise<GoogleOutcome> {
  let started;
  try {
    started = await auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: platform.redirectTo,
        // En web se deja que supabase-js redirija el navegador; en nativo no puede hacerlo,
        // así que se pide la URL y se abre a mano.
        skipBrowserRedirect: !platform.isWeb,
      },
    });
  } catch {
    return { ok: false, error: 'oauth-fallido' };
  }

  if (started.error) {
    return { ok: false, error: 'oauth-fallido' };
  }

  if (platform.isWeb) {
    // El navegador ya está navegando hacia Google. La sesión aparecerá al volver por la ruta
    // de callback; devolver aquí una sesión sería inventarla.
    return { ok: true, session: null, pending: true };
  }

  const authorizeUrl = started.data.url;
  if (!authorizeUrl) {
    return { ok: false, error: 'oauth-fallido' };
  }

  let opened;
  try {
    opened = await platform.openAuthSession(authorizeUrl, platform.redirectTo);
  } catch {
    return { ok: false, error: 'oauth-fallido' };
  }

  if (opened.type === 'cancel' || opened.type === 'dismiss') {
    return { ok: false, error: 'oauth-cancelado' };
  }
  if (opened.type !== 'success' || !opened.url) {
    return { ok: false, error: 'oauth-fallido' };
  }

  return sessionFromRedirectUrl(auth, platform, opened.url, toOutcome);
}
