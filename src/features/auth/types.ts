/**
 * Contrato propio de autenticación.
 *
 * Ninguna pantalla, ni el proveedor de estado, conocen Supabase. Hablan con este contrato, y
 * solo la capa de infraestructura lo implementa sobre `@supabase/supabase-js`
 * (docs/ARCHITECTURE.md, regla 2):
 *
 * ```text
 * UI → AuthProvider → AuthService → SupabaseAuthService → @supabase/supabase-js
 * ```
 *
 * El tipo de sesión es deliberadamente pobre: identificador, correo y caducidad. **Los
 * tokens no salen de la librería.** Duplicarlos en el estado de React los expondría a
 * cualquier registro, a cualquier captura de estado y a cualquier `console.log` accidental,
 * sin aportar nada: quien tiene que firmar las peticiones es el cliente de Supabase.
 */

export type AuthUser = {
  /**
   * Identificador estable del usuario.
   *
   * Es lo que da nombre al espacio de datos locales. Nunca el correo: el correo puede
   * cambiar (docs/PRODUCT.md, 2026-09-02).
   */
  id: string;
  email: string | null;
};

export type AuthSession = {
  user: AuthUser;
  /** Instante de caducidad en milisegundos desde epoch. `null` si la librería no lo da. */
  expiresAt: number | null;
};

export type AuthErrorCode =
  /** Correo o contraseña incorrectos. Un único código a propósito: ver `errors.ts`. */
  | 'credenciales-invalidas'
  | 'email-invalido'
  | 'password-rechazada'
  | 'registro-rechazado'
  | 'verificacion-pendiente'
  | 'oauth-cancelado'
  | 'oauth-fallido'
  | 'demasiados-intentos'
  | 'sin-conexion'
  | 'sin-configuracion'
  | 'sesion-expirada'
  | 'desconocido';

export type AuthOutcome =
  | { ok: true; session: AuthSession }
  | { ok: false; error: AuthErrorCode };

export type SignUpOutcome =
  | { ok: true; session: AuthSession }
  /**
   * El usuario existe pero el proyecto exige confirmar el correo.
   *
   * No se fabrica sesión: si Supabase no la ha creado, la aplicación tampoco puede darla por
   * creada (docs/PRODUCT.md, 2026-09-02).
   */
  | { ok: true; session: null; verificationRequired: true }
  | { ok: false; error: AuthErrorCode };

export type GoogleOutcome =
  | { ok: true; session: AuthSession }
  /**
   * En web el navegador se va a Google y vuelve por la ruta de callback, así que no hay
   * sesión que devolver aquí: la operación queda pendiente de ese regreso.
   */
  | { ok: true; session: null; pending: true }
  | { ok: false; error: AuthErrorCode };

export type AuthService = {
  /** `false` cuando falta configuración. Ninguna operación funcionará. */
  readonly configured: boolean;
  /** Nombres de las variables de entorno que faltan, si faltan. */
  readonly missingConfiguration: readonly string[];
  getSession: () => Promise<AuthSession | null>;
  /** Se suscribe a los cambios de sesión. Devuelve la función para darse de baja. */
  onAuthStateChange: (listener: (session: AuthSession | null) => void) => () => void;
  signInWithEmail: (email: string, password: string) => Promise<AuthOutcome>;
  signUpWithEmail: (email: string, password: string) => Promise<SignUpOutcome>;
  signInWithGoogle: () => Promise<GoogleOutcome>;
  /**
   * Completa una sesión a partir del enlace por el que la aplicación se ha abierto.
   *
   * En iOS y Android hay dos maneras de volver a la aplicación con una sesión dentro de la
   * URL: el regreso de Google y el enlace de confirmación de correo. El primero lo resuelve
   * `signInWithGoogle` sin salir de su propia llamada; el segundo llega en frío, y alguien
   * tiene que leerlo. En web no hace falta: lo hace la propia librería al arrancar.
   */
  completeSessionFromUrl: (url: string) => Promise<GoogleOutcome>;
  signOut: () => Promise<void>;
};

/**
 * Normalización del correo antes de enviarlo.
 *
 * Solo espacios sobrantes: quitar el espacio que deja el teclado del móvil al autocompletar
 * es una corrección evidente. Cambiar mayúsculas o el resto del texto no lo es, y tampoco es
 * asunto del cliente: quien decide qué correos son equivalentes es el proveedor.
 *
 * Las contraseñas no se tocan nunca.
 */
export function normalizeEmail(email: string): string {
  return email.trim();
}
