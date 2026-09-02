import { createAuthService } from '../../src/features/auth/service';
import {
  readSupabaseConfig,
  SUPABASE_KEY_VAR,
  SUPABASE_URL_VAR,
} from '../../src/features/auth/supabase/config';

/**
 * Configuración y elección de servicio.
 *
 * Dos cosas que no pueden fallar: que la falta de variables no rompa la aplicación ni cree
 * ninguna sesión, y que el doble de pruebas no pueda activarse en producción.
 */

const CONFIGURADO = {
  [SUPABASE_URL_VAR]: 'https://proyecto.supabase.co',
  [SUPABASE_KEY_VAR]: 'sb_publishable_xxx',
};

describe('Lectura de la configuración', () => {
  it('acepta las dos variables y recorta espacios', () => {
    expect(
      readSupabaseConfig({
        [SUPABASE_URL_VAR]: '  https://proyecto.supabase.co  ',
        [SUPABASE_KEY_VAR]: ' sb_publishable_xxx ',
      }),
    ).toEqual({
      ok: true,
      config: { url: 'https://proyecto.supabase.co', publishableKey: 'sb_publishable_xxx' },
    });
  });

  it('enumera exactamente lo que falta', () => {
    expect(readSupabaseConfig({})).toEqual({
      ok: false,
      missing: [SUPABASE_URL_VAR, SUPABASE_KEY_VAR],
    });
    expect(readSupabaseConfig({ [SUPABASE_URL_VAR]: 'https://p.supabase.co' })).toEqual({
      ok: false,
      missing: [SUPABASE_KEY_VAR],
    });
  });

  it('una variable vacía o en blanco cuenta como ausente', () => {
    expect(readSupabaseConfig({ ...CONFIGURADO, [SUPABASE_KEY_VAR]: '   ' })).toEqual({
      ok: false,
      missing: [SUPABASE_KEY_VAR],
    });
  });

  it('los nombres son los del contrato', () => {
    expect(SUPABASE_URL_VAR).toBe('EXPO_PUBLIC_SUPABASE_URL');
    expect(SUPABASE_KEY_VAR).toBe('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
  });
});

describe('Elección de servicio', () => {
  const originalFake = process.env.EXPO_PUBLIC_AUTH_FAKE;

  afterEach(() => {
    if (originalFake === undefined) {
      delete process.env.EXPO_PUBLIC_AUTH_FAKE;
    } else {
      process.env.EXPO_PUBLIC_AUTH_FAKE = originalFake;
    }
  });

  it('sin configuración devuelve el servicio no configurado, sin crear ningún cliente', async () => {
    delete process.env.EXPO_PUBLIC_AUTH_FAKE;

    const service = createAuthService({ ok: false, missing: [SUPABASE_URL_VAR] });

    expect(service.configured).toBe(false);
    expect(service.missingConfiguration).toEqual([SUPABASE_URL_VAR]);
    // Y sobre todo: no hay sesión que nadie pueda confundir con una de verdad.
    expect(await service.getSession()).toBeNull();
  });

  it('sin configuración, ninguna operación autentica', async () => {
    delete process.env.EXPO_PUBLIC_AUTH_FAKE;
    const service = createAuthService({ ok: false, missing: [SUPABASE_KEY_VAR] });

    expect(await service.signInWithEmail('ana@example.com', 'lo-que-sea')).toEqual({
      ok: false,
      error: 'sin-configuracion',
    });
  });

  it('el doble de pruebas solo se activa con la bandera explícita', async () => {
    delete process.env.EXPO_PUBLIC_AUTH_FAKE;
    expect(createAuthService({ ok: false, missing: [] }).configured).toBe(false);

    process.env.EXPO_PUBLIC_AUTH_FAKE = '1';
    expect(createAuthService({ ok: false, missing: [] }).configured).toBe(true);

    process.env.EXPO_PUBLIC_AUTH_FAKE = '0';
    expect(createAuthService({ ok: false, missing: [] }).configured).toBe(false);
  });

  it('el doble no puede activarse fuera de desarrollo', () => {
    process.env.EXPO_PUBLIC_AUTH_FAKE = '1';
    // `__DEV__` lo define el runtime de React Native; TypeScript no lo conoce en el ámbito
    // global, así que se accede con un tipo explícito.
    const entorno = globalThis as unknown as { __DEV__: boolean };
    const dev = entorno.__DEV__;
    try {
      // En un bundle de producción `__DEV__` es falso, y esa es toda la protección que hace
      // falta: la condición del servicio lo lee en cada llamada.
      entorno.__DEV__ = false;
      const service = createAuthService({ ok: false, missing: [SUPABASE_URL_VAR] });
      expect(service.configured).toBe(false);
      expect(service.missingConfiguration).toEqual([SUPABASE_URL_VAR]);
    } finally {
      entorno.__DEV__ = dev;
    }
  });
});
