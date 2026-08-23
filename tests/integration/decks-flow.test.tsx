import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';

import { routes } from './routes';

async function crearMazo(nombre: string) {
  fireEvent.changeText(screen.getByTestId('deck-name-input'), nombre);
  await act(async () => {
    fireEvent.press(screen.getByTestId('create-deck-button'));
  });
}

describe('Flujo: crear mazo', () => {
  it('parte de un estado vacío que explica qué hacer', async () => {
    renderRouter(routes, { initialUrl: '/' });

    expect(await screen.findByTestId('decks-empty')).toBeTruthy();
    expect(screen.getByText('Todavía no tienes mazos')).toBeTruthy();
    expect(screen.queryByTestId('decks-list')).toBeNull();
  });

  it('crea el mazo y aparece en la lista sin recargar', async () => {
    renderRouter(routes, { initialUrl: '/' });
    await screen.findByTestId('create-deck-button');

    await crearMazo('Inglés');

    expect(await screen.findByTestId('decks-list')).toBeTruthy();
    expect(screen.getByText('Inglés')).toBeTruthy();
    expect(screen.getByText(/0 cartas/)).toBeTruthy();
    expect(screen.queryByTestId('decks-empty')).toBeNull();
  });

  it('vacía el campo tras crear, para poder crear otro', async () => {
    renderRouter(routes, { initialUrl: '/' });
    await screen.findByTestId('create-deck-button');

    await crearMazo('Inglés');

    expect(screen.getByTestId('deck-name-input').props.value).toBe('');
  });

  it('actualiza el recuento de mazos de la cabecera', async () => {
    renderRouter(routes, { initialUrl: '/' });
    await screen.findByTestId('create-deck-button');

    expect(screen.getByText('0 mazos')).toBeTruthy();
    await crearMazo('Inglés');
    expect(screen.getByText('1 mazo')).toBeTruthy();
    await crearMazo('Alemán');
    expect(screen.getByText('2 mazos')).toBeTruthy();
  });

  it('muestra un error legible si el nombre está vacío y no crea nada', async () => {
    renderRouter(routes, { initialUrl: '/' });
    await screen.findByTestId('create-deck-button');

    await crearMazo('   ');

    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText('Escribe un nombre para el mazo.')).toBeTruthy();
    expect(screen.getByTestId('decks-empty')).toBeTruthy();
  });

  it('ancla el error al campo del nombre', async () => {
    renderRouter(routes, { initialUrl: '/' });
    await screen.findByTestId('create-deck-button');

    await crearMazo('');

    expect(screen.getByTestId('deck-name-input-error')).toBeTruthy();
  });

  it('el error desaparece al corregir el campo', async () => {
    renderRouter(routes, { initialUrl: '/' });
    await screen.findByTestId('create-deck-button');

    await crearMazo('');
    expect(screen.getByText('Escribe un nombre para el mazo.')).toBeTruthy();

    fireEvent.changeText(screen.getByTestId('deck-name-input'), 'Inglés');

    expect(screen.queryByText('Escribe un nombre para el mazo.')).toBeNull();
  });
});

describe('Flujo: entrar al detalle de un mazo', () => {
  it('abre el mazo pulsándolo en la lista', async () => {
    renderRouter(routes, { initialUrl: '/' });
    await screen.findByTestId('create-deck-button');
    await crearMazo('Inglés');

    await act(async () => {
      fireEvent.press(screen.getByTestId('deck-mazo-1'));
    });

    expect(await screen.findByTestId('add-card-button')).toBeTruthy();
    expect(screen.getByTestId('cards-empty')).toBeTruthy();
    expect(screen.getAllByText('Inglés').length).toBeGreaterThan(0);
  });

  it('vuelve a Mis mazos desde el detalle', async () => {
    renderRouter(routes, { initialUrl: '/' });
    await screen.findByTestId('create-deck-button');
    await crearMazo('Inglés');

    await act(async () => {
      fireEvent.press(screen.getByTestId('deck-mazo-1'));
    });
    await screen.findByTestId('add-card-button');

    await act(async () => {
      fireEvent.press(screen.getByTestId('back-to-decks'));
    });

    expect(await screen.findByTestId('create-deck-button')).toBeTruthy();
  });
});
