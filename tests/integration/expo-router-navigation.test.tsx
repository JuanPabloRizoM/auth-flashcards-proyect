import { renderRouter, screen } from 'expo-router/testing-library';

import { routes } from './routes';

describe('Expo Router', () => {
  it('monta el layout raíz y resuelve "/" en Mis mazos', async () => {
    renderRouter(routes, { initialUrl: '/' });

    expect(await screen.findByTestId('create-deck-button')).toBeTruthy();
    expect(screen.getByTestId('deck-name-input')).toBeTruthy();
  });

  it('resuelve "/componentes" en el catálogo del sistema visual', async () => {
    renderRouter(routes, { initialUrl: '/componentes' });

    expect(await screen.findByTestId('catalogo-button-primary')).toBeTruthy();
    expect(screen.getByTestId('catalogo-input-error')).toBeTruthy();
  });

  it('resuelve la ruta de detalle de un mazo aunque el mazo no exista', async () => {
    renderRouter(routes, { initialUrl: '/mazo/mazo-inexistente' });

    expect(await screen.findByTestId('back-to-decks')).toBeTruthy();
    expect(screen.getByText('Ese mazo ya no existe')).toBeTruthy();
  });

  it('resuelve la ruta de estudio de un mazo', async () => {
    renderRouter(routes, { initialUrl: '/mazo/mazo-inexistente/estudiar' });

    expect(await screen.findByTestId('back-to-decks')).toBeTruthy();
  });

  it('devuelve la ruta not-found para una URL inexistente', async () => {
    renderRouter(routes, { initialUrl: '/ruta-inexistente' });

    expect(screen.queryByTestId('create-deck-button')).toBeNull();
    expect(screen.queryByTestId('catalogo-button-primary')).toBeNull();
  });
});
