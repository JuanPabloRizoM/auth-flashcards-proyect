/**
 * Configuración del proyecto Supabase.
 *
 * Las dos variables son públicas por diseño —viajan en el bundle del cliente— y por eso
 * llevan el prefijo `EXPO_PUBLIC_`, que es lo que hace que Expo las incruste en tiempo de
 * compilación. La clave publicable (antes «anon») es la única clase de clave que puede vivir
 * en un cliente: **`service_role` no se usa nunca aquí** (docs/SECURITY.md).
 *
 * Que sean públicas no significa que se escriban en el código: vienen del entorno para que
 * desarrollo, pruebas y producción puedan apuntar a proyectos distintos, y para que el
 * repositorio no contenga el identificador del proyecto de nadie.
 */

export const SUPABASE_URL_VAR = 'EXPO_PUBLIC_SUPABASE_URL';
export const SUPABASE_KEY_VAR = 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY';

export type SupabaseConfig = {
  url: string;
  publishableKey: string;
};

export type SupabaseConfigResult =
  | { ok: true; config: SupabaseConfig }
  /** Faltan variables. La aplicación no debe crear cliente ni inventarse una sesión. */
  | { ok: false; missing: string[] };

export type RawEnv = {
  [SUPABASE_URL_VAR]?: string;
  [SUPABASE_KEY_VAR]?: string;
};

/**
 * Las variables tal y como llegan del entorno.
 *
 * Se leen con el nombre literal a propósito: Expo sustituye textualmente
 * `process.env.EXPO_PUBLIC_…` al compilar, así que un acceso dinámico
 * (`process.env[nombre]`) devolvería `undefined` en el bundle.
 */
export function readRawEnv(): RawEnv {
  return {
    [SUPABASE_URL_VAR]: process.env.EXPO_PUBLIC_SUPABASE_URL,
    [SUPABASE_KEY_VAR]: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  };
}

export function readSupabaseConfig(env: RawEnv = readRawEnv()): SupabaseConfigResult {
  const url = env[SUPABASE_URL_VAR]?.trim() ?? '';
  const publishableKey = env[SUPABASE_KEY_VAR]?.trim() ?? '';

  const missing: string[] = [];
  if (url === '') missing.push(SUPABASE_URL_VAR);
  if (publishableKey === '') missing.push(SUPABASE_KEY_VAR);
  if (missing.length > 0) {
    return { ok: false, missing };
  }

  return { ok: true, config: { url, publishableKey } };
}
