import type { SupabaseAuthApi, SupabaseSessionLike } from '../../src/features/auth/supabase/authApi';
import type { OAuthPlatform } from '../../src/features/auth/supabase/googleOAuth';
import {
  createSupabaseAuthService,
  createUnconfiguredAuthService,
  toAuthSession,
} from '../../src/features/auth/supabase/supabaseAuthService';

/**
 * El adaptador de Supabase Auth, contra un cliente simulado.
 *
 * No hay red ni proyecto: lo que se demuestra es el **contrato** —qué API se llama, con qué
 * argumentos, y en qué se convierte cada respuesta—. La integración real con Supabase se
 * verifica aparte y necesita credenciales.
 */

const SESION_SUPABASE: SupabaseSessionLike = {
  user: { id: '4f3a-1111', email: 'ana@example.com' },
  expires_at: 1_800_000_000,
};

type Llamadas = {
  signInWithPassword: { email: string; password: string }[];
  signUp: { email: string; password: string; options?: { emailRedirectTo?: string } }[];
  signInWithOAuth: unknown[];
  signOut: number;
};

function clienteSimulado(overrides: Partial<SupabaseAuthApi> = {}) {
  const llamadas: Llamadas = { signInWithPassword: [], signUp: [], signInWithOAuth: [], signOut: 0 };
  let listener: ((event: string, session: SupabaseSessionLike | null) => void) | null = null;
  let desuscrito = false;

  const auth: SupabaseAuthApi = {
    getSession: async () => ({ data: { session: null }, error: null }),
    onAuthStateChange: (callback) => {
      listener = callback;
      return {
        data: {
          subscription: {
            unsubscribe: () => {
              desuscrito = true;
            },
          },
        },
      };
    },
    signInWithPassword: async (credenciales) => {
      llamadas.signInWithPassword.push(credenciales);
      return { data: { session: SESION_SUPABASE, user: SESION_SUPABASE.user }, error: null };
    },
    signUp: async (credenciales) => {
      llamadas.signUp.push(credenciales);
      return { data: { session: SESION_SUPABASE, user: SESION_SUPABASE.user }, error: null };
    },
    signInWithOAuth: async (params) => {
      llamadas.signInWithOAuth.push(params);
      return { data: { url: 'https://accounts.google.com/o/oauth2/auth?...' }, error: null };
    },
    setSession: async () => ({ data: { session: SESION_SUPABASE }, error: null }),
    exchangeCodeForSession: async () => ({ data: { session: SESION_SUPABASE }, error: null }),
    signOut: async () => {
      llamadas.signOut += 1;
      return { error: null };
    },
    ...overrides,
  };

  return {
    auth,
    llamadas,
    emitir: (session: SupabaseSessionLike | null) => listener?.('SIGNED_IN', session),
    estaDesuscrito: () => desuscrito,
  };
}

const plataformaWeb: OAuthPlatform = {
  isWeb: true,
  redirectTo: 'http://localhost:8081/auth/callback',
  openAuthSession: async () => ({ type: 'success', url: '' }),
  // Lectura mínima pero real del enlace de vuelta, para que el test no dependa de una
  // respuesta fijada de antemano.
  getQueryParams: (url) => {
    const params: Record<string, string> = {};
    for (const par of (url.split('#')[1] ?? url.split('?')[1] ?? '').split('&')) {
      const [clave, valor] = par.split('=');
      if (clave) params[clave] = valor ?? '';
    }
    return { params, errorCode: null };
  },
};

function crear(overrides: Partial<SupabaseAuthApi> = {}, emailRedirectTo?: string) {
  const simulado = clienteSimulado(overrides);
  return {
    ...simulado,
    service: createSupabaseAuthService({
      auth: simulado.auth,
      platform: plataformaWeb,
      emailRedirectTo,
    }),
  };
}

describe('Traducción de la sesión', () => {
  it('conserva identificador y correo, y pasa la caducidad a milisegundos', () => {
    expect(toAuthSession(SESION_SUPABASE)).toEqual({
      user: { id: '4f3a-1111', email: 'ana@example.com' },
      expiresAt: 1_800_000_000_000,
    });
  });

  it('no expone ningún token', () => {
    const conTokens = {
      ...SESION_SUPABASE,
      access_token: 'ey.secreto',
      refresh_token: 'refresco-secreto',
    } as SupabaseSessionLike;

    const dominio = toAuthSession(conTokens);

    expect(JSON.stringify(dominio)).not.toContain('secreto');
    expect(Object.keys(dominio ?? {})).toEqual(['user', 'expiresAt']);
  });

  it('una sesión sin usuario no es una sesión', () => {
    expect(toAuthSession({ user: null })).toBeNull();
    expect(toAuthSession(null)).toBeNull();
  });

  it('un correo ausente se representa como nulo, no como cadena vacía', () => {
    expect(toAuthSession({ user: { id: 'x' } })?.user.email).toBeNull();
  });
});

describe('Inicio de sesión con correo', () => {
  it('llama a signInWithPassword y devuelve la sesión', async () => {
    const { service, llamadas } = crear();

    const resultado = await service.signInWithEmail('  ana@example.com  ', 'secreto');

    expect(llamadas.signInWithPassword).toEqual([
      // El correo se recorta; la contraseña no se toca jamás.
      { email: 'ana@example.com', password: 'secreto' },
    ]);
    expect(resultado).toEqual({
      ok: true,
      session: { user: { id: '4f3a-1111', email: 'ana@example.com' }, expiresAt: 1_800_000_000_000 },
    });
  });

  it('unas credenciales inválidas no crean sesión y dan el código genérico', async () => {
    const { service } = crear({
      signInWithPassword: async () => ({
        data: { session: null, user: null },
        error: { code: 'invalid_credentials', message: 'Invalid login credentials' },
      }),
    });

    expect(await service.signInWithEmail('ana@example.com', 'mala')).toEqual({
      ok: false,
      error: 'credenciales-invalidas',
    });
  });

  it('una respuesta sin error pero sin sesión tampoco autentica', async () => {
    const { service } = crear({
      signInWithPassword: async () => ({ data: { session: null, user: null }, error: null }),
    });

    expect(await service.signInWithEmail('ana@example.com', 'x')).toEqual({
      ok: false,
      error: 'credenciales-invalidas',
    });
  });

  it('una excepción del cliente se traduce, no se propaga', async () => {
    const { service } = crear({
      signInWithPassword: async () => {
        throw Object.assign(new Error('fetch failed'), { name: 'AuthRetryableFetchError' });
      },
    });

    expect(await service.signInWithEmail('ana@example.com', 'x')).toEqual({
      ok: false,
      error: 'sin-conexion',
    });
  });
});

describe('Registro con correo', () => {
  it('llama a signUp con el redirect de confirmación', async () => {
    const { service, llamadas } = crear({}, 'flashcards://auth/callback');

    await service.signUpWithEmail('nueva@example.com', 'secreto');

    expect(llamadas.signUp).toEqual([
      {
        email: 'nueva@example.com',
        password: 'secreto',
        options: { emailRedirectTo: 'flashcards://auth/callback' },
      },
    ]);
  });

  it('con autoconfirmación devuelve sesión', async () => {
    const { service } = crear();
    const resultado = await service.signUpWithEmail('nueva@example.com', 'secreto');

    expect(resultado.ok && resultado.session !== null).toBe(true);
  });

  it('con verificación requerida devuelve usuario sin sesión, y no la inventa', async () => {
    const { service } = crear({
      signUp: async () => ({
        data: { session: null, user: { id: 'pendiente-1', email: 'nueva@example.com' } },
        error: null,
      }),
    });

    expect(await service.signUpWithEmail('nueva@example.com', 'secreto')).toEqual({
      ok: true,
      session: null,
      verificationRequired: true,
    });
  });

  it('sin usuario y sin sesión, el registro se considera rechazado', async () => {
    const { service } = crear({
      signUp: async () => ({ data: { session: null, user: null }, error: null }),
    });

    expect(await service.signUpWithEmail('nueva@example.com', 'x')).toEqual({
      ok: false,
      error: 'registro-rechazado',
    });
  });

  it('una contraseña rechazada por el servidor se explica como tal', async () => {
    const { service } = crear({
      signUp: async () => ({
        data: { session: null, user: null },
        error: { code: 'weak_password' },
      }),
    });

    expect(await service.signUpWithEmail('nueva@example.com', '123')).toEqual({
      ok: false,
      error: 'password-rechazada',
    });
  });
});

describe('Sesión guardada y cambios de estado', () => {
  it('restaura la sesión que el cliente tenga persistida', async () => {
    const { service } = crear({
      getSession: async () => ({ data: { session: SESION_SUPABASE }, error: null }),
    });

    expect(await service.getSession()).toEqual({
      user: { id: '4f3a-1111', email: 'ana@example.com' },
      expiresAt: 1_800_000_000_000,
    });
  });

  it('un error al leer la sesión se entiende como ausencia de sesión, no se inventa una', async () => {
    const { service } = crear({
      getSession: async () => ({ data: { session: null }, error: { code: 'unexpected_failure' } }),
    });

    expect(await service.getSession()).toBeNull();
  });

  it('los cambios de estado llegan traducidos al dominio', async () => {
    const { service, emitir } = crear();
    const recibidas: unknown[] = [];

    const cancelar = service.onAuthStateChange((session) => recibidas.push(session));
    emitir(SESION_SUPABASE);
    emitir(null);

    expect(recibidas).toEqual([
      { user: { id: '4f3a-1111', email: 'ana@example.com' }, expiresAt: 1_800_000_000_000 },
      null,
    ]);
    cancelar();
  });

  it('darse de baja cancela la suscripción del cliente', () => {
    const { service, estaDesuscrito } = crear();

    const cancelar = service.onAuthStateChange(() => undefined);
    expect(estaDesuscrito()).toBe(false);

    cancelar();
    expect(estaDesuscrito()).toBe(true);
  });
});

describe('Completar la sesión desde un enlace', () => {
  it('convierte el enlace de vuelta en sesión', async () => {
    const { service } = crear();

    const resultado = await service.completeSessionFromUrl(
      'flashcards://auth/callback#access_token=a&refresh_token=b',
    );

    expect(resultado).toEqual({
      ok: true,
      session: { user: { id: '4f3a-1111', email: 'ana@example.com' }, expiresAt: 1_800_000_000_000 },
    });
  });

  it('un enlace inservible no crea sesión', async () => {
    const { service } = crear({
      setSession: async () => ({ data: { session: null }, error: { code: 'invalid_token' } }),
    });

    expect(
      await service.completeSessionFromUrl('flashcards://auth/callback#access_token=a&refresh_token=b'),
    ).toEqual({ ok: false, error: 'oauth-fallido' });
  });
});

describe('Cierre de sesión', () => {
  it('llama a signOut', async () => {
    const { service, llamadas } = crear();
    await service.signOut();
    expect(llamadas.signOut).toBe(1);
  });

  it('un fallo remoto no impide cerrar sesión', async () => {
    const { service } = crear({
      signOut: async () => {
        throw new Error('el servicio no responde');
      },
    });

    await expect(service.signOut()).resolves.toBeUndefined();
  });
});

describe('Servicio sin configuración', () => {
  const service = createUnconfiguredAuthService(['EXPO_PUBLIC_SUPABASE_URL']);

  it('se declara no configurado y dice qué falta', () => {
    expect(service.configured).toBe(false);
    expect(service.missingConfiguration).toEqual(['EXPO_PUBLIC_SUPABASE_URL']);
  });

  it('nunca devuelve una sesión', async () => {
    expect(await service.getSession()).toBeNull();
  });

  it('rechaza toda operación con el código de configuración', async () => {
    expect(await service.signInWithEmail('a@b.c', 'x')).toEqual({
      ok: false,
      error: 'sin-configuracion',
    });
    expect(await service.signUpWithEmail('a@b.c', 'x')).toEqual({
      ok: false,
      error: 'sin-configuracion',
    });
    expect(await service.signInWithGoogle()).toEqual({ ok: false, error: 'sin-configuracion' });
    expect(await service.completeSessionFromUrl('flashcards://x')).toEqual({
      ok: false,
      error: 'sin-configuracion',
    });
  });
});
