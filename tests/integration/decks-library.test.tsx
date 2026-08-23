import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';

import { routes } from './routes';

/**
 * Mis mazos como biblioteca: buscar, ordenar y ver la información de cada mazo.
 *
 * Se monta la aplicación real y se opera desde la interfaz, sin tocar el estado por debajo.
 */

async function crearMazo(nombre: string) {
  fireEvent.changeText(screen.getByTestId('deck-name-input'), nombre);
  await act(async () => {
    fireEvent.press(screen.getByTestId('create-deck-button'));
  });
}

async function buscar(termino: string) {
  await act(async () => {
    fireEvent.changeText(screen.getByTestId('deck-search-input'), termino);
  });
}

async function pulsar(testID: string) {
  await act(async () => {
    fireEvent.press(screen.getByTestId(testID));
  });
}

/** Los nombres de los mazos tal y como aparecen en pantalla, en su orden. */
function nombresEnPantalla(): string[] {
  return screen
    .getAllByTestId(/^deck-mazo-/)
    .map((node) => String(node.props.accessibilityLabel).replace('Abrir el mazo ', ''));
}

async function biblioteca() {
  renderRouter(routes, { initialUrl: '/' });
  await screen.findByTestId('create-deck-button');

  await crearMazo('Inglés');
  await crearMazo('anatomía');
  await crearMazo('Química');
  await screen.findByTestId('decks-list');
}

describe('Búsqueda de mazos', () => {
  it('no aparece cuando todavía no hay ningún mazo', async () => {
    renderRouter(routes, { initialUrl: '/' });
    await screen.findByTestId('create-deck-button');

    expect(screen.queryByTestId('deck-search-input')).toBeNull();
    expect(screen.getByTestId('decks-empty')).toBeTruthy();
  });

  it('filtra sin distinguir mayúsculas y sin recargar', async () => {
    await biblioteca();

    await buscar('ANATOMÍA');

    expect(nombresEnPantalla()).toEqual(['anatomía']);
  });

  it('encuentra por un trozo del nombre', async () => {
    await biblioteca();

    await buscar('quím');

    expect(nombresEnPantalla()).toEqual(['Química']);
  });

  it('muestra un estado vacío propio cuando nada coincide', async () => {
    await biblioteca();

    await buscar('alemán');

    expect(await screen.findByTestId('decks-search-empty')).toBeTruthy();
    // No es el estado vacío de "todavía no tienes mazos": ese diría otra cosa.
    expect(screen.queryByTestId('decks-empty')).toBeNull();
    expect(screen.queryByTestId('decks-list')).toBeNull();
  });

  it('limpiar la búsqueda devuelve la lista completa', async () => {
    await biblioteca();
    await buscar('alemán');
    await screen.findByTestId('decks-search-empty');

    await pulsar('decks-search-empty-clear');

    expect(await screen.findByTestId('decks-list')).toBeTruthy();
    expect(nombresEnPantalla()).toHaveLength(3);
    expect(screen.getByTestId('deck-search-input').props.value).toBe('');
  });

  it('el botón de limpiar de la tarjeta de búsqueda también funciona', async () => {
    await biblioteca();
    await buscar('inglés');

    await pulsar('deck-search-clear');

    expect(nombresEnPantalla()).toHaveLength(3);
  });

  it('la cabecera sigue contando todos los mazos, no solo los filtrados', async () => {
    await biblioteca();

    await buscar('inglés');

    expect(screen.getByText('3 mazos')).toBeTruthy();
  });
});

describe('Orden de los mazos', () => {
  it('empieza ordenando por nombre A-Z', async () => {
    await biblioteca();

    expect(nombresEnPantalla()).toEqual(['anatomía', 'Inglés', 'Química']);
  });

  it('ordena por nombre Z-A', async () => {
    await biblioteca();

    await pulsar('deck-sort-nombre-desc');

    expect(nombresEnPantalla()).toEqual(['Química', 'Inglés', 'anatomía']);
  });

  it('ordena por modificación más reciente', async () => {
    await biblioteca();

    await pulsar('deck-sort-reciente');

    // Se crearon en orden: Inglés, anatomía, Química. El último creado es el más reciente.
    expect(nombresEnPantalla()).toEqual(['Química', 'anatomía', 'Inglés']);
  });

  it('ordena por modificación más antigua', async () => {
    await biblioteca();

    await pulsar('deck-sort-antiguo');

    expect(nombresEnPantalla()).toEqual(['Inglés', 'anatomía', 'Química']);
  });

  it('mantiene el orden elegido mientras se busca', async () => {
    await biblioteca();
    await pulsar('deck-sort-nombre-desc');

    await buscar('a');

    expect(nombresEnPantalla()).toEqual(['Química', 'anatomía']);
  });
});

describe('Información de cada mazo', () => {
  it('muestra el nombre y el recuento de cartas', async () => {
    renderRouter(routes, { initialUrl: '/' });
    await screen.findByTestId('create-deck-button');
    await crearMazo('Inglés');
    await screen.findByTestId('decks-list');

    expect(screen.getByText('Inglés')).toBeTruthy();
    expect(screen.getByText(/0 cartas/)).toBeTruthy();
  });

  it('actualiza el recuento cuando el mazo gana cartas', async () => {
    renderRouter(routes, { initialUrl: '/' });
    await screen.findByTestId('create-deck-button');
    await crearMazo('Inglés');
    await pulsar('deck-mazo-1');
    await screen.findByTestId('add-card-button');

    fireEvent.changeText(screen.getByTestId('card-front-input'), 'one');
    fireEvent.changeText(screen.getByTestId('card-back-input'), 'uno');
    await act(async () => {
      fireEvent.press(screen.getByTestId('add-card-button'));
    });
    await pulsar('back-to-decks');
    await screen.findByTestId('decks-list');

    expect(screen.getByText(/1 carta ·/)).toBeTruthy();
  });

  it('muestra la fecha de última modificación', async () => {
    renderRouter(routes, { initialUrl: '/' });
    await screen.findByTestId('create-deck-button');
    await crearMazo('Inglés');
    await screen.findByTestId('decks-list');

    expect(screen.getByText(/Modificado el /)).toBeTruthy();
  });

  it('un mazo creado con una búsqueda activa no desaparece de la vista', async () => {
    await biblioteca();
    await buscar('zzz');
    await screen.findByTestId('decks-search-empty');

    await crearMazo('Alemán');

    expect(await screen.findByTestId('decks-list')).toBeTruthy();
    expect(nombresEnPantalla()).toContain('Alemán');
  });
});
