import type { SupabaseAuthApi, SupabaseSessionLike } from '../../src/features/auth/supabase/authApi';
import {
  sessionFromRedirectUrl,
  signInWithGoogle,
  type OAuthPlatform,
} from '../../src/features/auth/supabase/googleOAuth';
import { toAuthSession } from '../../src/features/auth/supabase/supabaseAuthService';
import type { GoogleOutcome } from '../../src/features/auth/types';

/**
 * El viaje de ida y vuelta a Google, sin Google.
 *
 * Se simulan las dos piezas que la aplicación no controla —el cliente de Supabase y la
 * sesión de navegador del sistema— y se comprueba qué hace el adaptador con cada respuesta
 * posible: éxito, cancelación, error del proveedor y callback inservible.
 */

const SESION: SupabaseSessionLike = { user: { id: 'u-1', email: 'ana@example.com' }, expires_at: 100 };

const aResultado = (session: SupabaseSessionLike | null): GoogleOutcome => {
  const mapped = toAuthSession(session);
  return mapped === null ? { ok: false, error: 'oauth-fallido' } : { ok: true, session: mapped };
};

type Registro = {
  oauth: { provider: string; options?: { redirectTo?: string; skipBrowserRedirect?: boolean } }[];
  setSession: { access_token: string; refresh_token: string }[];
  exchange: string[];
  abiertos: { url: string; redirectTo: string }[];
};

function entorno(options: {
  isWeb?: boolean;
  urlAutorizacion?: string | null;
  errorOAuth?: unknown;
  regreso?: { type: string; url?: string | null };
  /** La sesión de navegador del sistema lanza en vez de devolver un resultado. */
  regresoLanza?: boolean;
  params?: Record<string, string | undefined>;
  errorCode?: string | null;
  setSessionError?: unknown;
} = {}) {
  const registro: Registro = { oauth: [], setSession: [], exchange: [], abiertos: [] };

  const auth: Pick<
    SupabaseAuthApi,
    'signInWithOAuth' | 'setSession' | 'exchangeCodeForSession'
  > = {
    signInWithOAuth: async (params) => {
      registro.oauth.push(params);
      if (options.errorOAuth) {
        return { data: { url: null }, error: options.errorOAuth };
      }
      return {
        data: { url: options.urlAutorizacion === undefined ? 'https://google/auth' : options.urlAutorizacion },
        error: null,
      };
    },
    setSession: async (tokens) => {
      registro.setSession.push(tokens);
      if (options.setSessionError) {
        return { data: { session: null }, error: options.setSessionError };
      }
      return { data: { session: SESION }, error: null };
    },
    exchangeCodeForSession: async (code) => {
      registro.exchange.push(code);
      return { data: { session: SESION }, error: null };
    },
  };

  const platform: OAuthPlatform = {
    isWeb: options.isWeb ?? false,
    redirectTo: 'flashcards://auth/callback',
    openAuthSession: async (url, redirectTo) => {
      registro.abiertos.push({ url, redirectTo });
      if (options.regresoLanza === true) {
        throw new Error('el navegador del sistema no está disponible');
      }
      return (
        options.regreso ?? {
          type: 'success',
          url: 'flashcards://auth/callback#access_token=a&refresh_token=b',
        }
      );
    },
    getQueryParams: () => ({
      params: options.params ?? { access_token: 'a', refresh_token: 'b' },
      errorCode: options.errorCode ?? null,
    }),
  };

  return { auth: auth as SupabaseAuthApi, platform, registro };
}

describe('En web', () => {
  it('deja que supabase-js redirija el navegador y queda pendiente del regreso', async () => {
    const { auth, platform, registro } = entorno({ isWeb: true });

    const resultado = await signInWithGoogle(auth, platform, aResultado);

    expect(registro.oauth).toEqual([
      {
        provider: 'google',
        options: { redirectTo: 'flashcards://auth/callback', skipBrowserRedirect: false },
      },
    ]);
    // No se abre ninguna sesión de navegador: ya la abre la propia navegación.
    expect(registro.abiertos).toHaveLength(0);
    expect(resultado).toEqual({ ok: true, session: null, pending: true });
  });

  it('un error al pedir la URL se traduce a fallo de OAuth', async () => {
    const { auth, platform } = entorno({ isWeb: true, errorOAuth: { code: 'provider_disabled' } });

    expect(await signInWithGoogle(auth, platform, aResultado)).toEqual({
      ok: false,
      error: 'oauth-fallido',
    });
  });
});

describe('En iOS y Android', () => {
  it('pide la URL sin redirigir, abre la sesión de navegador y crea la sesión con los tokens', async () => {
    const { auth, platform, registro } = entorno();

    const resultado = await signInWithGoogle(auth, platform, aResultado);

    expect(registro.oauth[0]?.options?.skipBrowserRedirect).toBe(true);
    expect(registro.abiertos).toEqual([
      { url: 'https://google/auth', redirectTo: 'flashcards://auth/callback' },
    ]);
    expect(registro.setSession).toEqual([{ access_token: 'a', refresh_token: 'b' }]);
    expect(resultado).toEqual({
      ok: true,
      session: { user: { id: 'u-1', email: 'ana@example.com' }, expiresAt: 100_000 },
    });
  });

  it('un proyecto con PKCE devuelve un código y se canjea', async () => {
    const { auth, platform, registro } = entorno({ params: { code: 'codigo-de-un-solo-uso' } });

    const resultado = await signInWithGoogle(auth, platform, aResultado);

    expect(registro.exchange).toEqual(['codigo-de-un-solo-uso']);
    expect(registro.setSession).toHaveLength(0);
    expect(resultado.ok).toBe(true);
  });

  it('cancelar no es un fallo: se distingue', async () => {
    for (const type of ['cancel', 'dismiss']) {
      const { auth, platform } = entorno({ regreso: { type } });
      expect(await signInWithGoogle(auth, platform, aResultado)).toEqual({
        ok: false,
        error: 'oauth-cancelado',
      });
    }
  });

  it('un error devuelto en el enlace de vuelta es un fallo de OAuth', async () => {
    const { auth, platform } = entorno({ errorCode: 'access_denied' });

    expect(await signInWithGoogle(auth, platform, aResultado)).toEqual({
      ok: false,
      error: 'oauth-fallido',
    });
  });

  it('un callback sin tokens ni código no crea sesión', async () => {
    const { auth, platform, registro } = entorno({ params: {} });

    expect(await signInWithGoogle(auth, platform, aResultado)).toEqual({
      ok: false,
      error: 'oauth-fallido',
    });
    expect(registro.setSession).toHaveLength(0);
    expect(registro.exchange).toHaveLength(0);
  });

  it('sin URL de autorización no se abre nada', async () => {
    const { auth, platform, registro } = entorno({ urlAutorizacion: null });

    expect(await signInWithGoogle(auth, platform, aResultado)).toEqual({
      ok: false,
      error: 'oauth-fallido',
    });
    expect(registro.abiertos).toHaveLength(0);
  });

  it('si setSession falla, no se da la sesión por buena', async () => {
    const { auth, platform } = entorno({ setSessionError: { code: 'invalid_token' } });

    expect(await signInWithGoogle(auth, platform, aResultado)).toEqual({
      ok: false,
      error: 'oauth-fallido',
    });
  });

  it('una excepción de la sesión de navegador no se propaga', async () => {
    const { auth, platform } = entorno({ regresoLanza: true });

    expect(await signInWithGoogle(auth, platform, aResultado)).toEqual({
      ok: false,
      error: 'oauth-fallido',
    });
  });
});

describe('Enlaces de vuelta que llegan en frío', () => {
  /**
   * En iOS y Android el enlace de confirmación de correo abre la aplicación sin pasar por
   * `signInWithGoogle`: nadie lo ha pedido dentro de una llamada en curso. Esta es la lectura
   * que convierte ese enlace en sesión.
   */
  it('con tokens en la URL crea la sesión', async () => {
    const { auth, platform, registro } = entorno();

    const resultado = await sessionFromRedirectUrl(
      auth,
      platform,
      'flashcards://auth/callback#access_token=a&refresh_token=b',
      aResultado,
    );

    expect(registro.setSession).toEqual([{ access_token: 'a', refresh_token: 'b' }]);
    expect(resultado.ok).toBe(true);
    // Y no abre ninguna sesión de navegador: el viaje ya ocurrió.
    expect(registro.abiertos).toHaveLength(0);
  });

  it('con un código lo canjea', async () => {
    const { auth, platform, registro } = entorno({ params: { code: 'c-1' } });

    expect((await sessionFromRedirectUrl(auth, platform, 'flashcards://x', aResultado)).ok).toBe(
      true,
    );
    expect(registro.exchange).toEqual(['c-1']);
  });

  it('un enlace caducado o sin datos no crea sesión y se puede contar al usuario', async () => {
    const { auth, platform } = entorno({ params: {} });

    expect(await sessionFromRedirectUrl(auth, platform, 'flashcards://x', aResultado)).toEqual({
      ok: false,
      error: 'oauth-fallido',
    });
  });

  it('un enlace con error del proveedor tampoco', async () => {
    const { auth, platform } = entorno({ errorCode: 'access_denied' });

    expect(await sessionFromRedirectUrl(auth, platform, 'flashcards://x', aResultado)).toEqual({
      ok: false,
      error: 'oauth-fallido',
    });
  });

  it('si la lectura del enlace lanza, no se propaga', async () => {
    const { auth, platform } = entorno();
    const roto: OAuthPlatform = {
      ...platform,
      getQueryParams: () => {
        throw new Error('URL ilegible');
      },
    };

    expect(await sessionFromRedirectUrl(auth, roto, 'no es una url', aResultado)).toEqual({
      ok: false,
      error: 'oauth-fallido',
    });
  });
});
