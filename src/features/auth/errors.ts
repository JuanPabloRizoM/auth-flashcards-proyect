import type { AuthErrorCode } from './types';

/**
 * Traducción de los fallos de autenticación a mensajes propios.
 *
 * Dos reglas gobiernan este archivo:
 *
 * 1. **No se reenvía nunca el mensaje del proveedor.** Los textos de Supabase están en
 *    inglés, cambian entre versiones y a veces describen detalles internos. Aquí se traduce
 *    a un código propio y de ahí a una frase escrita por el proyecto.
 * 2. **No se ayuda a enumerar cuentas.** «Usuario no encontrado» y «contraseña incorrecta»
 *    colapsan en un único `credenciales-invalidas` con un único mensaje. Distinguirlos
 *    convierte la pantalla de acceso en un comprobador de qué direcciones existen.
 */

const messages: Record<AuthErrorCode, string> = {
  'credenciales-invalidas': 'No pudimos iniciar sesión con esos datos.',
  'email-invalido': 'Esa dirección de correo no parece válida.',
  'password-rechazada': 'El servicio no ha aceptado esa contraseña. Prueba con otra más larga.',
  'registro-rechazado': 'No hemos podido crear la cuenta con esos datos.',
  'verificacion-pendiente': 'Revisa tu correo para confirmar tu cuenta.',
  'oauth-cancelado': 'Has cancelado el acceso con Google.',
  'oauth-fallido': 'No hemos podido completar el acceso con Google.',
  'demasiados-intentos': 'Demasiados intentos seguidos. Espera un momento y vuelve a probar.',
  'sin-conexion': 'No hay conexión con el servicio de acceso. Comprueba tu red.',
  'sin-configuracion': 'El acceso no está configurado en esta instalación de la aplicación.',
  'sesion-expirada': 'Tu sesión ha caducado. Vuelve a iniciar sesión.',
  desconocido: 'No hemos podido completar la operación. Inténtalo de nuevo.',
};

export function authErrorMessage(code: AuthErrorCode): string {
  return messages[code];
}

/** Lo que se puede leer de un error de `@supabase/supabase-js` sin depender de sus clases. */
type UnknownAuthError = {
  code?: unknown;
  status?: unknown;
  name?: unknown;
  message?: unknown;
};

function readCode(error: UnknownAuthError): string {
  return typeof error.code === 'string' ? error.code : '';
}

/**
 * Traduce un error del proveedor a un código propio.
 *
 * Se mira primero `code`, que es la parte estable del contrato de Supabase. `status` y
 * `name` son la red de seguridad para errores de transporte, que no traen código.
 */
export function mapSupabaseAuthError(error: unknown): AuthErrorCode {
  if (typeof error !== 'object' || error === null) {
    return 'desconocido';
  }
  const candidate = error as UnknownAuthError;
  const code = readCode(candidate);

  switch (code) {
    case 'invalid_credentials':
    case 'user_not_found':
      return 'credenciales-invalidas';
    case 'email_not_confirmed':
      return 'verificacion-pendiente';
    case 'weak_password':
      return 'password-rechazada';
    case 'validation_failed':
    case 'email_address_invalid':
      return 'email-invalido';
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return 'demasiados-intentos';
    case 'session_expired':
    case 'refresh_token_not_found':
    case 'refresh_token_already_used':
      return 'sesion-expirada';
    case 'signup_disabled':
    case 'email_exists':
    case 'user_already_exists':
      // No se confirma que la dirección ya exista: sería enumeración de cuentas por la
      // puerta del registro.
      return 'registro-rechazado';
    default:
      break;
  }

  if (candidate.status === 400 || candidate.status === 401) {
    return 'credenciales-invalidas';
  }
  if (candidate.status === 429) {
    return 'demasiados-intentos';
  }
  if (candidate.name === 'AuthRetryableFetchError' || candidate.status === 0) {
    return 'sin-conexion';
  }
  return 'desconocido';
}
