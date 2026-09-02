import { cleanAuthUrl, oauthErrorIn } from '../../src/features/auth/supabase/callbackUrl';

/**
 * Lo que queda en la barra de direcciones después de volver de Google.
 *
 * Los tokens no pueden sobrevivir al callback: quedan en el historial, viajan en el `Referer`
 * y se copian con el enlace.
 */

describe('Limpieza de la URL', () => {
  it('quita los tokens del fragmento', () => {
    expect(
      cleanAuthUrl(
        'http://localhost:8081/auth/callback#access_token=ey.secreto&refresh_token=r.secreto&expires_in=3600&token_type=bearer',
      ),
    ).toBe('http://localhost:8081/auth/callback');
  });

  it('quita el código y el estado de la query', () => {
    expect(cleanAuthUrl('https://app.example.com/auth/callback?code=abc123&state=xyz')).toBe(
      'https://app.example.com/auth/callback',
    );
  });

  it('conserva los parámetros que no son de autenticación', () => {
    expect(cleanAuthUrl('https://app.example.com/auth/callback?code=abc&vista=compacta')).toBe(
      'https://app.example.com/auth/callback?vista=compacta',
    );
  });

  it('quita también el error, que tampoco tiene por qué quedarse', () => {
    expect(
      cleanAuthUrl('https://app.example.com/auth/callback?error=access_denied&error_code=403'),
    ).toBe('https://app.example.com/auth/callback');
  });

  it('una URL ya limpia no cambia', () => {
    expect(cleanAuthUrl('https://app.example.com/estadisticas')).toBe(
      'https://app.example.com/estadisticas',
    );
  });

  it('no queda ningún rastro reconocible de un token', () => {
    const sucia =
      'https://app.example.com/auth/callback?code=abc#access_token=ey.J.secreto&provider_token=g.secreto';
    expect(cleanAuthUrl(sucia)).not.toContain('secreto');
    expect(cleanAuthUrl(sucia)).not.toContain('token');
    expect(cleanAuthUrl(sucia)).not.toContain('code');
  });
});

describe('Detección del error del proveedor', () => {
  it('lo encuentra en la query', () => {
    expect(oauthErrorIn('https://app/auth/callback?error=access_denied')).toBe('access_denied');
  });

  it('lo encuentra en el fragmento', () => {
    expect(oauthErrorIn('https://app/auth/callback#error=server_error&error_description=vaya')).toBe(
      'server_error',
    );
  });

  it('no ve errores donde no los hay', () => {
    expect(oauthErrorIn('https://app/auth/callback#access_token=a&refresh_token=b')).toBeNull();
    expect(oauthErrorIn('https://app/')).toBeNull();
  });
});
