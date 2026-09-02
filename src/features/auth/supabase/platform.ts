import { makeRedirectUri } from 'expo-auth-session';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import type { OAuthPlatform } from './googleOAuth';

/**
 * La mecánica real de cada plataforma para el viaje de ida y vuelta a Google.
 *
 * La ruta de regreso es siempre la misma, `/auth/callback`, y se deriva de la identidad de
 * la aplicación: en web, del origen desde el que se sirve; en iOS y Android, del `scheme`
 * que `app.json` declara desde TASK-001 (`flashcards`). No hay ninguna URL escrita a mano.
 *
 * Las URLs concretas que hay que registrar en Supabase y en Google Cloud están en
 * `docs/AUTH.md`.
 */

export const OAUTH_CALLBACK_PATH = 'auth/callback';

export function oauthRedirectTo(): string {
  return makeRedirectUri({ path: OAUTH_CALLBACK_PATH });
}

export function createOAuthPlatform(): OAuthPlatform {
  return {
    isWeb: Platform.OS === 'web',
    redirectTo: oauthRedirectTo(),
    openAuthSession: (url, redirectTo) => WebBrowser.openAuthSessionAsync(url, redirectTo),
    getQueryParams: (url) => {
      const { params, errorCode } = QueryParams.getQueryParams(url);
      return { params, errorCode };
    },
  };
}
