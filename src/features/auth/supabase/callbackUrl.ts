/**
 * Limpieza de la URL después de procesar un callback de OAuth.
 *
 * Al volver de Google, el proveedor deja los datos de la sesión en la URL: en el fragmento
 * (`#access_token=…`) o en la query (`?code=…`). Una vez procesados no pintan nada ahí: se
 * quedan en el historial del navegador, se copian al compartir el enlace y aparecen en el
 * `Referer`. Se retiran en cuanto la sesión existe.
 *
 * La función es pura para poder demostrarlo sin navegador; quien la usa sustituye la entrada
 * del historial con `replaceState`, que no recarga ni añade una entrada nueva.
 */

const AUTH_PARAMS = [
  'access_token',
  'refresh_token',
  'expires_in',
  'expires_at',
  'provider_token',
  'provider_refresh_token',
  'token_type',
  'type',
  'code',
  'error',
  'error_code',
  'error_description',
  'state',
];

/** La misma URL sin fragmento y sin los parámetros de autenticación. */
export function cleanAuthUrl(href: string): string {
  const [beforeHash] = href.split('#');
  const base = beforeHash ?? href;
  const [path, query] = base.split('?');
  const ruta = path ?? base;

  if (query === undefined || query === '') {
    return ruta;
  }

  const kept = query
    .split('&')
    .filter((pair) => pair !== '')
    .filter((pair) => !AUTH_PARAMS.includes(decodeURIComponent(pair.split('=')[0] ?? '')));

  return kept.length === 0 ? ruta : `${ruta}?${kept.join('&')}`;
}

/** ¿Trae esta URL un error devuelto por el proveedor en vez de una sesión? */
export function oauthErrorIn(href: string): string | null {
  const marks = [href.split('#')[1] ?? '', href.split('?')[1]?.split('#')[0] ?? ''];
  for (const mark of marks) {
    for (const pair of mark.split('&')) {
      const [key, value] = pair.split('=');
      if (key === 'error' || key === 'error_code') {
        return decodeURIComponent(value ?? 'oauth_error').replace(/\+/g, ' ');
      }
    }
  }
  return null;
}
