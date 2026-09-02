import { act, fireEvent, screen } from 'expo-router/testing-library';
import { Platform } from 'react-native';

import { montarConAuth, servicioProgramable, SESION_DE_PRUEBA } from './authHarness';
import { usarEnlaceDeCallback } from './routes';

/**
 * La pantalla de regreso del proveedor.
 *
 * Lo que se comprueba es que nunca se queda girando sin salida, y que en las plataformas
 * nativas —donde la librería no mira la URL— el enlace se procesa de verdad.
 */

beforeEach(() => {
  usarEnlaceDeCallback(null);
});

describe('Siempre hay salida', () => {
  it('mientras espera, muestra el estado y ofrece volver al acceso', async () => {
    montarConAuth(servicioProgramable({ sesionInicial: null }), '/auth/callback');

    expect(await screen.findByTestId('auth-callback-screen')).toBeTruthy();
    expect(screen.getByTestId('auth-callback-volver')).toBeTruthy();
  });

  it('el botón lleva a la pantalla de acceso', async () => {
    montarConAuth(servicioProgramable({ sesionInicial: null }), '/auth/callback');
    await screen.findByTestId('auth-callback-volver');

    await act(async () => {
      fireEvent.press(screen.getByTestId('auth-callback-volver'));
    });

    expect(await screen.findByTestId('login-submit')).toBeTruthy();
  });

  it('con sesión ya creada, el guard lleva a la aplicación', async () => {
    montarConAuth(servicioProgramable({ sesionInicial: SESION_DE_PRUEBA }), '/auth/callback');

    expect(await screen.findByTestId('create-deck-button')).toBeTruthy();
  });
});

// En web la sesión la crea la propia librería al arrancar; este camino es el de iOS y Android.
const nativo = Platform.OS === 'web' ? describe.skip : describe;

nativo('En iOS y Android el enlace se procesa', () => {
  it('un enlace válido crea la sesión y se entra a la aplicación', async () => {
    usarEnlaceDeCallback('flashcards://auth/callback#access_token=a&refresh_token=b');
    const service = servicioProgramable({
      sesionInicial: null,
      completeFromUrl: { ok: true, session: SESION_DE_PRUEBA },
    });

    montarConAuth(service, '/auth/callback');

    expect(await screen.findByTestId('create-deck-button')).toBeTruthy();
    expect(service.calls.completeFromUrl).toBe(1);
  });

  it('un enlace que ya no sirve se cuenta, en vez de girar para siempre', async () => {
    usarEnlaceDeCallback('flashcards://auth/callback#access_token=caducado&refresh_token=x');
    const service = servicioProgramable({
      sesionInicial: null,
      completeFromUrl: { ok: false, error: 'oauth-fallido' },
    });

    montarConAuth(service, '/auth/callback');

    expect(await screen.findByTestId('auth-callback-error')).toBeTruthy();
    expect(screen.queryByTestId('auth-callback-esperando')).toBeNull();
    expect(screen.getByTestId('auth-callback-volver')).toBeTruthy();
  });

  it('sin enlace no se llama al servicio, y la salida sigue estando', async () => {
    const service = servicioProgramable({ sesionInicial: null });

    montarConAuth(service, '/auth/callback');
    await screen.findByTestId('auth-callback-volver');

    expect(service.calls.completeFromUrl).toBe(0);
  });
});
