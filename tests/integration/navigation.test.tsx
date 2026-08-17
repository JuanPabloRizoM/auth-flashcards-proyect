import { router } from 'expo-router';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';

import ComponentesScreen from '../../app/componentes';
import RootLayout from '../../app/_layout';
import IndexScreen from '../../app/index';
import { navigationItems } from '../../src/components/layout';

const routes = {
  _layout: RootLayout,
  index: IndexScreen,
  componentes: ComponentesScreen,
};

describe('Navegación base', () => {
  it('expone un destino de navegación por cada ruta declarada', async () => {
    renderRouter(routes, { initialUrl: '/' });

    await screen.findByTestId('demo-card');

    for (const item of navigationItems) {
      expect(screen.getByTestId(item.testID)).toBeTruthy();
    }
  });

  it('navega de inicio al catálogo y cambia el contenido renderizado', async () => {
    renderRouter(routes, { initialUrl: '/' });

    expect(await screen.findByTestId('demo-card')).toBeTruthy();

    await act(async () => {
      fireEvent.press(screen.getByTestId('nav-componentes'));
    });

    expect(await screen.findByTestId('catalogo-button-primary')).toBeTruthy();
    expect(screen.queryByTestId('demo-card')).toBeNull();
  });

  it('vuelve al inicio desde el catálogo', async () => {
    renderRouter(routes, { initialUrl: '/componentes' });

    expect(await screen.findByTestId('catalogo-button-primary')).toBeTruthy();

    await act(async () => {
      fireEvent.press(screen.getByTestId('nav-inicio'));
    });

    expect(await screen.findByTestId('demo-card')).toBeTruthy();
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

    await screen.findByTestId('demo-card');
    expect(router.canGoBack()).toBe(false);

    await act(async () => {
      fireEvent.press(screen.getByTestId('nav-componentes'));
    });
    await screen.findByTestId('catalogo-button-primary');
    expect(router.canGoBack()).toBe(false);

    await act(async () => {
      fireEvent.press(screen.getByTestId('nav-inicio'));
    });
    await screen.findByTestId('demo-card');

    expect(router.canGoBack()).toBe(false);
    expect(screen.getAllByTestId('demo-card')).toHaveLength(1);
    expect(screen.queryAllByTestId('catalogo-button-primary')).toHaveLength(0);
  });

  it('marca como seleccionado el destino de la ruta activa', async () => {
    renderRouter(routes, { initialUrl: '/componentes' });

    await screen.findByTestId('catalogo-button-primary');

    expect(screen.getByTestId('nav-componentes').props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId('nav-inicio').props.accessibilityState.selected).toBe(false);
  });
});
