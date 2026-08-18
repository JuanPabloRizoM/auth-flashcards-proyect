import { router } from 'expo-router';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';

import { navigationItems } from '../../src/components/layout';
import { routes } from './routes';

describe('Navegación base', () => {
  it('expone un destino de navegación por cada ruta de primer nivel', async () => {
    renderRouter(routes, { initialUrl: '/' });

    await screen.findByTestId('create-deck-button');

    for (const item of navigationItems) {
      expect(screen.getByTestId(item.testID)).toBeTruthy();
    }
  });

  it('navega de Mis mazos al catálogo y cambia el contenido renderizado', async () => {
    renderRouter(routes, { initialUrl: '/' });

    expect(await screen.findByTestId('create-deck-button')).toBeTruthy();

    await act(async () => {
      fireEvent.press(screen.getByTestId('nav-componentes'));
    });

    expect(await screen.findByTestId('catalogo-button-primary')).toBeTruthy();
    expect(screen.queryByTestId('create-deck-button')).toBeNull();
  });

  it('vuelve a Mis mazos desde el catálogo', async () => {
    renderRouter(routes, { initialUrl: '/componentes' });

    expect(await screen.findByTestId('catalogo-button-primary')).toBeTruthy();

    await act(async () => {
      fireEvent.press(screen.getByTestId('nav-mazos'));
    });

    expect(await screen.findByTestId('create-deck-button')).toBeTruthy();
    expect(screen.queryByTestId('catalogo-button-primary')).toBeNull();
  });

  // Regresión del bug de navegación: los destinos de primer nivel deben sustituir la ruta
  // actual, no apilarse. Con router.navigate el historial crecía y volver a una ruta ya
  // visitada montaba una segunda instancia de la pantalla.
  //
  // La comprobación es sobre el historial, no sobre cuántos nodos hay montados: en
  // renderRouter la pantalla anterior se desmonta, así que contar nodos no distinguiría
  // navigate de replace y el test sería vacuo.
  it('no acumula historial al navegar entre destinos de primer nivel', async () => {
    renderRouter(routes, { initialUrl: '/' });

    await screen.findByTestId('create-deck-button');
    expect(router.canGoBack()).toBe(false);

    await act(async () => {
      fireEvent.press(screen.getByTestId('nav-componentes'));
    });
    await screen.findByTestId('catalogo-button-primary');
    expect(router.canGoBack()).toBe(false);

    await act(async () => {
      fireEvent.press(screen.getByTestId('nav-mazos'));
    });
    await screen.findByTestId('create-deck-button');

    expect(router.canGoBack()).toBe(false);
    expect(screen.getAllByTestId('create-deck-button')).toHaveLength(1);
    expect(screen.queryAllByTestId('catalogo-button-primary')).toHaveLength(0);
  });

  it('marca como seleccionado el destino de la ruta activa', async () => {
    renderRouter(routes, { initialUrl: '/componentes' });

    await screen.findByTestId('catalogo-button-primary');

    expect(screen.getByTestId('nav-componentes').props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId('nav-mazos').props.accessibilityState.selected).toBe(false);
  });
});
