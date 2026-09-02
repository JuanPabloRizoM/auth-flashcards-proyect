import { act, fireEvent, screen } from 'expo-router/testing-library';

import { createFakeAuthService, fakeAuthState, FAKE_AUTH_STORAGE_KEY } from '../../src/features/auth/fakeAuthService';
import type { AuthService } from '../../src/features/auth/types';

import { montarConAuth, servicioProgramable, SESION_DE_PRUEBA } from './authHarness';

/**
 * Restauración, caducidad y cierre de sesión.
 *
 * El requisito difícil de todos estos es el negativo: mientras la sesión se resuelve, la
 * aplicación no puede enseñar contenido privado ni por un instante. Aquí se comprueba
 * afirmando sobre el árbol montado en ese momento exacto.
 */

function medioCompartido() {
  const mapa = new Map<string, string>();
  return {
    mapa,
    storage: {
      getItem: async (key: string) => mapa.get(key) ?? null,
      setItem: async (key: string, value: string) => {
        mapa.set(key, value);
      },
    },
  };
}

describe('Arranque', () => {
  it('mientras se resuelve la sesión se muestra el indicador de carga', async () => {
    montarConAuth(servicioProgramable({ arranqueColgado: true }), '/');

    expect(await screen.findByTestId('auth-bootstrap')).toBeTruthy();
  });

  it('durante ese rato no se ve contenido privado, aunque la sesión vaya a ser válida', async () => {
    montarConAuth(servicioProgramable({ arranqueColgado: true }), '/estadisticas');
    await screen.findByTestId('auth-bootstrap');

    expect(screen.queryByTestId('create-deck-button')).toBeNull();
    expect(screen.queryByTestId('stats-scope')).toBeNull();
    expect(screen.queryByTestId('app-sidebar')).toBeNull();
  });

  it('tampoco se ve la pantalla de acceso antes de saber si hay sesión', async () => {
    montarConAuth(servicioProgramable({ arranqueColgado: true }), '/login');
    await screen.findByTestId('auth-bootstrap');

    expect(screen.queryByTestId('login-submit')).toBeNull();
  });

  it('con una sesión guardada se entra sin pedir credenciales', async () => {
    montarConAuth(servicioProgramable({ sesionInicial: SESION_DE_PRUEBA }), '/');

    expect(await screen.findByTestId('create-deck-button')).toBeTruthy();
    expect(screen.queryByTestId('login-submit')).toBeNull();
  });

  it('sin sesión guardada se acaba en el acceso', async () => {
    montarConAuth(servicioProgramable({ sesionInicial: null }), '/');

    expect(await screen.findByTestId('login-submit')).toBeTruthy();
  });
});

describe('Reinicio de la aplicación', () => {
  it('la sesión sobrevive a desmontar y volver a montar sobre el mismo almacenamiento', async () => {
    const medio = medioCompartido();

    const primera = createFakeAuthService({ storage: medio.storage });
    const arbol = montarConAuth(primera, '/login');
    await screen.findByTestId('login-submit');
    await act(async () => {
      await primera.signUpWithEmail('ana@example.com', 'secreto');
    });
    await screen.findByTestId('create-deck-button');

    arbol.unmount();

    // Una instancia nueva del servicio, como en un arranque en frío.
    const segunda: AuthService = createFakeAuthService({ storage: medio.storage });
    montarConAuth(segunda, '/');

    expect(await screen.findByTestId('create-deck-button')).toBeTruthy();
  });

  it('una sesión ya caducada se trata como ausencia de sesión', async () => {
    const medio = medioCompartido();
    medio.mapa.set(
      FAKE_AUTH_STORAGE_KEY,
      fakeAuthState({
        accounts: [{ id: 'usuario-a', email: 'ana@example.com', password: 'x' }],
        signedInAs: 'usuario-a',
        expiresAt: Date.now() - 1_000,
      }),
    );

    montarConAuth(createFakeAuthService({ storage: medio.storage }), '/');

    expect(await screen.findByTestId('login-submit')).toBeTruthy();
  });
});

describe('Cambios de estado en caliente', () => {
  it('perder la sesión lleva a la pantalla de acceso sin recargar', async () => {
    const service = servicioProgramable({ sesionInicial: SESION_DE_PRUEBA });
    montarConAuth(service, '/estadisticas');
    await screen.findByTestId('stats-scope');

    await act(async () => {
      service.emitir(null);
    });

    expect(await screen.findByTestId('login-submit')).toBeTruthy();
    expect(screen.queryByTestId('stats-scope')).toBeNull();
  });

  it('recuperar la sesión devuelve a la aplicación sin recargar', async () => {
    const service = servicioProgramable({ sesionInicial: null });
    montarConAuth(service, '/login');
    await screen.findByTestId('login-submit');

    await act(async () => {
      service.emitir(SESION_DE_PRUEBA);
    });

    expect(await screen.findByTestId('create-deck-button')).toBeTruthy();
  });
});

describe('Cierre de sesión', () => {
  it('la acción está disponible en la aplicación y devuelve al acceso', async () => {
    const service = servicioProgramable({ sesionInicial: SESION_DE_PRUEBA });
    montarConAuth(service, '/');
    await screen.findByTestId('create-deck-button');

    expect(screen.getByTestId('cuenta-email')).toBeTruthy();

    await act(async () => {
      fireEvent.press(screen.getByTestId('cerrar-sesion'));
    });

    expect(service.calls.signOut).toBe(1);
    expect(await screen.findByTestId('login-submit')).toBeTruthy();
    expect(screen.queryByTestId('create-deck-button')).toBeNull();
  });
});
