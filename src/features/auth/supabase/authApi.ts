/**
 * La parte de `@supabase/supabase-js` que este proyecto usa, descrita de forma estructural.
 *
 * No se importan los tipos de la librería aquí a propósito: describir la superficie exacta
 * que se consume deja por escrito de qué APIs depende la aplicación, y permite que los tests
 * unitarios ejerciten el adaptador con un cliente simulado sin arrastrar la librería —ni su
 * red— al proceso de pruebas.
 *
 * Todos los nombres son los de la API vigente de Supabase Auth (v2): `signInWithPassword`,
 * `signUp`, `signInWithOAuth`, `setSession`, `exchangeCodeForSession`, `signOut`,
 * `getSession` y `onAuthStateChange`.
 */

export type SupabaseUserLike = {
  id: string;
  email?: string | null;
};

export type SupabaseSessionLike = {
  user: SupabaseUserLike | null;
  /** Segundos desde epoch, como los devuelve Supabase. */
  expires_at?: number | null;
};

export type SupabaseResult<T> = { data: T; error: unknown };

export type SupabaseAuthApi = {
  getSession: () => Promise<SupabaseResult<{ session: SupabaseSessionLike | null }>>;
  onAuthStateChange: (
    callback: (event: string, session: SupabaseSessionLike | null) => void,
  ) => { data: { subscription: { unsubscribe: () => void } } };
  signInWithPassword: (credentials: {
    email: string;
    password: string;
  }) => Promise<SupabaseResult<{ session: SupabaseSessionLike | null; user: SupabaseUserLike | null }>>;
  signUp: (credentials: {
    email: string;
    password: string;
    options?: { emailRedirectTo?: string };
  }) => Promise<SupabaseResult<{ session: SupabaseSessionLike | null; user: SupabaseUserLike | null }>>;
  signInWithOAuth: (params: {
    provider: 'google';
    options?: { redirectTo?: string; skipBrowserRedirect?: boolean };
  }) => Promise<SupabaseResult<{ url: string | null }>>;
  setSession: (tokens: {
    access_token: string;
    refresh_token: string;
  }) => Promise<SupabaseResult<{ session: SupabaseSessionLike | null }>>;
  exchangeCodeForSession: (
    code: string,
  ) => Promise<SupabaseResult<{ session: SupabaseSessionLike | null }>>;
  signOut: () => Promise<{ error: unknown }>;
};
