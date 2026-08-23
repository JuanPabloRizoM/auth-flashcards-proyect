import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';

import { routes } from './routes';

async function crearMazo(nombre: string) {
  fireEvent.changeText(screen.getByTestId('deck-name-input'), nombre);
  await act(async () => {
    fireEvent.press(screen.getByTestId('create-deck-button'));
  });
}

async function abrirMazo(id: string) {
  await act(async () => {
    fireEvent.press(screen.getByTestId(`deck-${id}`));
  });
  await screen.findByTestId('add-card-button');
}

async function anadirCarta(frente: string, reverso: string) {
  fireEvent.changeText(screen.getByTestId('card-front-input'), frente);
  fireEvent.changeText(screen.getByTestId('card-back-input'), reverso);
  await act(async () => {
    fireEvent.press(screen.getByTestId('add-card-button'));
  });
}

async function prepararMazoAbierto(nombre = 'Inglés', id = 'mazo-1') {
  renderRouter(routes, { initialUrl: '/' });
  await screen.findByTestId('create-deck-button');
  await crearMazo(nombre);
  await abrirMazo(id);
}

describe('Flujo: crear flashcards', () => {
  it('un mazo nuevo muestra el estado vacío de cartas', async () => {
    await prepararMazoAbierto();

    expect(screen.getByTestId('cards-empty')).toBeTruthy();
    expect(screen.getByText('Este mazo todavía no tiene cartas')).toBeTruthy();
    expect(screen.queryByTestId('cards-list')).toBeNull();
  });

  it('crea una carta con frente y reverso y la muestra en el mazo', async () => {
    await prepararMazoAbierto();

    await anadirCarta('to overlook', 'pasar por alto');

    expect(await screen.findByTestId('cards-list')).toBeTruthy();
    expect(screen.getByText('to overlook')).toBeTruthy();
    expect(screen.getByText('pasar por alto')).toBeTruthy();
    expect(screen.queryByTestId('cards-empty')).toBeNull();
  });

  it('vacía el formulario tras añadir, para poder encadenar cartas', async () => {
    await prepararMazoAbierto();

    await anadirCarta('to overlook', 'pasar por alto');

    expect(screen.getByTestId('card-front-input').props.value).toBe('');
    expect(screen.getByTestId('card-back-input').props.value).toBe('');
  });

  it('actualiza el recuento de cartas del mazo', async () => {
    await prepararMazoAbierto();

    expect(screen.getByText('0 cartas')).toBeTruthy();
    await anadirCarta('to overlook', 'pasar por alto');
    expect(screen.getByText('1 carta')).toBeTruthy();
    await anadirCarta('to withstand', 'resistir');
    expect(screen.getByText('2 cartas')).toBeTruthy();
  });

  it('muestra un error legible si falta el frente, anclado a ese campo', async () => {
    await prepararMazoAbierto();

    await anadirCarta('   ', 'pasar por alto');

    expect(screen.getByText('Escribe el frente de la carta.')).toBeTruthy();
    // El error debe señalar el campo que falla, no otro cualquiera del formulario.
    expect(screen.getByTestId('card-front-input-error')).toBeTruthy();
    expect(screen.queryByTestId('card-back-input-error')).toBeNull();
    expect(screen.getByTestId('cards-empty')).toBeTruthy();
  });

  it('muestra un error legible si falta el reverso, anclado a ese campo', async () => {
    await prepararMazoAbierto();

    await anadirCarta('to overlook', '');

    expect(screen.getByText('Escribe el reverso de la carta.')).toBeTruthy();
    expect(screen.getByTestId('card-back-input-error')).toBeTruthy();
    expect(screen.queryByTestId('card-front-input-error')).toBeNull();
    expect(screen.getByTestId('cards-empty')).toBeTruthy();
  });
});

describe('Las cartas pertenecen a su mazo', () => {
  it('una carta creada en un mazo no aparece en otro', async () => {
    renderRouter(routes, { initialUrl: '/' });
    await screen.findByTestId('create-deck-button');
    await crearMazo('Inglés');
    await crearMazo('Alemán');

    await abrirMazo('mazo-1');
    await anadirCarta('to overlook', 'pasar por alto');
    expect(screen.getByText('to overlook')).toBeTruthy();

    await act(async () => {
      fireEvent.press(screen.getByTestId('back-to-decks'));
    });
    await screen.findByTestId('create-deck-button');

    await abrirMazo('mazo-2');

    expect(screen.queryByText('to overlook')).toBeNull();
    expect(screen.getByTestId('cards-empty')).toBeTruthy();
  });

  it('la lista de Mis mazos refleja cuántas cartas tiene cada mazo', async () => {
    renderRouter(routes, { initialUrl: '/' });
    await screen.findByTestId('create-deck-button');
    await crearMazo('Inglés');
    await crearMazo('Alemán');

    await abrirMazo('mazo-1');
    await anadirCarta('to overlook', 'pasar por alto');

    await act(async () => {
      fireEvent.press(screen.getByTestId('back-to-decks'));
    });
    await screen.findByTestId('decks-list');

    expect(screen.getByText(/1 carta ·/)).toBeTruthy();
    expect(screen.getByText(/0 cartas ·/)).toBeTruthy();
  });
});
