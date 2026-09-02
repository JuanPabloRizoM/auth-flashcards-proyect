import { authErrorMessage, mapSupabaseAuthError } from '../../src/features/auth/errors';
import type { AuthErrorCode } from '../../src/features/auth/types';

/**
 * Traducción de errores.
 *
 * Lo que se comprueba no es solo que cada código produzca su frase, sino las dos reglas de
 * seguridad: que el mensaje del proveedor no llegue nunca a la pantalla, y que la respuesta
 * no permita averiguar qué direcciones están registradas.
 */

const codigos: AuthErrorCode[] = [
  'credenciales-invalidas',
  'email-invalido',
  'password-rechazada',
  'registro-rechazado',
  'verificacion-pendiente',
  'oauth-cancelado',
  'oauth-fallido',
  'demasiados-intentos',
  'sin-conexion',
  'sin-configuracion',
  'sesion-expirada',
  'desconocido',
];

describe('Mensajes', () => {
  it('cada código tiene una frase propia, en español y no vacía', () => {
    const vistos = new Set<string>();
    for (const codigo of codigos) {
      const mensaje = authErrorMessage(codigo);
      expect(mensaje.length).toBeGreaterThan(10);
      vistos.add(mensaje);
    }
    expect(vistos.size).toBe(codigos.length);
  });

  it('el de credenciales es el que pide el contrato', () => {
    expect(authErrorMessage('credenciales-invalidas')).toBe(
      'No pudimos iniciar sesión con esos datos.',
    );
  });

  it('el de verificación es el que pide el contrato', () => {
    expect(authErrorMessage('verificacion-pendiente')).toBe(
      'Revisa tu correo para confirmar tu cuenta.',
    );
  });
});

describe('Traducción desde Supabase', () => {
  it('reconoce los códigos de la API vigente', () => {
    expect(mapSupabaseAuthError({ code: 'invalid_credentials' })).toBe('credenciales-invalidas');
    expect(mapSupabaseAuthError({ code: 'email_not_confirmed' })).toBe('verificacion-pendiente');
    expect(mapSupabaseAuthError({ code: 'weak_password' })).toBe('password-rechazada');
    expect(mapSupabaseAuthError({ code: 'validation_failed' })).toBe('email-invalido');
    expect(mapSupabaseAuthError({ code: 'over_request_rate_limit' })).toBe('demasiados-intentos');
    expect(mapSupabaseAuthError({ code: 'refresh_token_not_found' })).toBe('sesion-expirada');
  });

  it('un fallo de red se distingue de unas credenciales malas', () => {
    expect(mapSupabaseAuthError({ name: 'AuthRetryableFetchError', status: 0 })).toBe('sin-conexion');
  });

  it('sin código, el estado HTTP decide', () => {
    expect(mapSupabaseAuthError({ status: 400 })).toBe('credenciales-invalidas');
    expect(mapSupabaseAuthError({ status: 429 })).toBe('demasiados-intentos');
  });

  it('lo que no se reconoce no se inventa', () => {
    expect(mapSupabaseAuthError({ code: 'algo_que_no_existe' })).toBe('desconocido');
    expect(mapSupabaseAuthError(null)).toBe('desconocido');
    expect(mapSupabaseAuthError('texto suelto')).toBe('desconocido');
    expect(mapSupabaseAuthError(undefined)).toBe('desconocido');
  });
});

describe('Reglas de seguridad', () => {
  it('no se distingue una dirección inexistente de una contraseña incorrecta', () => {
    // Los dos casos colapsan en el mismo código y, por tanto, en el mismo mensaje.
    const inexistente = mapSupabaseAuthError({ code: 'user_not_found' });
    const contrasenaMala = mapSupabaseAuthError({ code: 'invalid_credentials' });

    expect(inexistente).toBe(contrasenaMala);
    expect(authErrorMessage(inexistente)).toBe(authErrorMessage(contrasenaMala));
  });

  it('un registro con una dirección ya usada tampoco lo confirma', () => {
    expect(mapSupabaseAuthError({ code: 'email_exists' })).toBe('registro-rechazado');
    expect(authErrorMessage('registro-rechazado')).not.toMatch(/ya (existe|está)/i);
  });

  it('el mensaje del proveedor nunca llega al usuario', () => {
    const original = 'Invalid login credentials for user 4f3a-... at auth.users';
    const codigo = mapSupabaseAuthError({ code: 'invalid_credentials', message: original });

    expect(authErrorMessage(codigo)).not.toContain(original);
    for (const c of codigos) {
      expect(authErrorMessage(c)).not.toMatch(/[a-z_]+_[a-z_]+/); // ni códigos internos
    }
  });
});
