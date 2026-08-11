import { renderRouter, screen } from 'expo-router/testing-library';

import RootLayout from '../../app/_layout';
import IndexScreen from '../../app/index';

describe('Expo Router', () => {
  it('monta el layout raíz y resuelve "/" en la pantalla index', async () => {
    renderRouter(
      {
        _layout: RootLayout,
        index: IndexScreen,
      },
      { initialUrl: '/' },
    );

    expect(await screen.findByText('Flashcards')).toBeTruthy();
    expect(screen.getByText('Entorno base preparado.')).toBeTruthy();
  });

  it('devuelve la ruta not-found para una URL inexistente', async () => {
    renderRouter(
      {
        _layout: RootLayout,
        index: IndexScreen,
      },
      { initialUrl: '/ruta-inexistente' },
    );

    expect(screen.queryByText('Entorno base preparado.')).toBeNull();
  });
});
