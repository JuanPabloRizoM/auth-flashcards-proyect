import { renderRouter, screen } from 'expo-router/testing-library';

import ComponentesScreen from '../../app/componentes';
import RootLayout from '../../app/_layout';
import IndexScreen from '../../app/index';

const routes = {
  _layout: RootLayout,
  index: IndexScreen,
  componentes: ComponentesScreen,
};

describe('Expo Router', () => {
  it('monta el layout raíz y resuelve "/" en la pantalla index', async () => {
    renderRouter(routes, { initialUrl: '/' });

    expect(await screen.findByTestId('demo-card')).toBeTruthy();
    expect(screen.getByTestId('demo-input')).toBeTruthy();
  });

  it('resuelve "/componentes" en el catálogo del sistema visual', async () => {
    renderRouter(routes, { initialUrl: '/componentes' });

    expect(await screen.findByTestId('catalogo-button-primary')).toBeTruthy();
    expect(screen.getByTestId('catalogo-input-error')).toBeTruthy();
  });

  it('devuelve la ruta not-found para una URL inexistente', async () => {
    renderRouter(routes, { initialUrl: '/ruta-inexistente' });

    expect(screen.queryByTestId('demo-card')).toBeNull();
    expect(screen.queryByTestId('catalogo-button-primary')).toBeNull();
  });
});
