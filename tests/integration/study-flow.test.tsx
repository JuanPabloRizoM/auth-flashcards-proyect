import { router } from 'expo-router';
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

async function pulsar(testID: string) {
  await act(async () => {
    fireEvent.press(screen.getByTestId(testID));
  });
}

async function prepararMazoConDosCartas() {
  renderRouter(routes, { initialUrl: '/' });
  await screen.findByTestId('create-deck-button');
  await crearMazo('Inglés');
  await abrirMazo('mazo-1');
  await anadirCarta('to overlook', 'pasar por alto');
  await anadirCarta('to withstand', 'resistir');
}

describe('Flujo: estudiar', () => {
  it('el botón Estudiar está inhabilitado mientras el mazo no tiene cartas', async () => {
    renderRouter(routes, { initialUrl: '/' });
    await screen.findByTestId('create-deck-button');
    await crearMazo('Inglés');
    await abrirMazo('mazo-1');

    expect(screen.getByTestId('study-button').props.accessibilityState.disabled).toBe(true);
  });

  it('recorre el ciclo Frente, Mostrar respuesta, Frente + Reverso, Siguiente carta', async () => {
    await prepararMazoConDosCartas();

    await pulsar('study-button');
    await screen.findByTestId('study-card');

    // Primera carta: solo el frente.
    expect(screen.getByTestId('study-front')).toBeTruthy();
    expect(screen.queryByTestId('study-back')).toBeNull();
    expect(screen.getByText('Carta 1 de 2')).toBeTruthy();
    expect(screen.getByTestId('reveal-button')).toBeTruthy();

    // Mostrar respuesta: frente y reverso a la vez.
    await pulsar('reveal-button');
    expect(screen.getByTestId('study-front')).toBeTruthy();
    expect(screen.getByTestId('study-back')).toBeTruthy();
    expect(screen.getByText('pasar por alto')).toBeTruthy();
    expect(screen.queryByTestId('reveal-button')).toBeNull();

    // Siguiente carta: otra vez solo el frente.
    await pulsar('next-card-button');
    expect(screen.queryByTestId('study-back')).toBeNull();
    expect(screen.getByText('to withstand')).toBeTruthy();
    expect(screen.getByText('Carta 2 de 2')).toBeTruthy();
  });

  it('comunica el final de la sesión y permite volver al mazo', async () => {
    await prepararMazoConDosCartas();

    await pulsar('study-button');
    await screen.findByTestId('study-card');

    await pulsar('reveal-button');
    await pulsar('next-card-button');
    await pulsar('reveal-button');
    await pulsar('next-card-button');

    expect(await screen.findByTestId('study-finished')).toBeTruthy();
    expect(screen.getByText('Sesión terminada')).toBeTruthy();
    expect(screen.getByText('Has repasado las 2 cartas de este mazo.')).toBeTruthy();

    await pulsar('finish-back-button');

    expect(await screen.findByTestId('add-card-button')).toBeTruthy();
  });

  it('no ofrece ningún control de calificación durante el estudio', async () => {
    await prepararMazoConDosCartas();

    await pulsar('study-button');
    await screen.findByTestId('study-card');
    await pulsar('reveal-button');

    ['Otra vez', 'Difícil', 'Bien', 'Fácil', 'Repasar', 'Calificar'].forEach((texto) => {
      expect(screen.queryByText(texto)).toBeNull();
    });
  });

  // Regresión: volver del estudio al mazo con `replace` dejaba montada la instancia
  // anterior del detalle y duplicaba su contenido. La comprobación es sobre la profundidad
  // del apilado, no sobre cuántos nodos hay montados: en renderRouter la pantalla anterior
  // se desmonta, así que contar nodos no distinguiría `replace` de `back`.
  it('volver del estudio no añade un nivel extra al apilado', async () => {
    await prepararMazoConDosCartas();

    await pulsar('study-button');
    await screen.findByTestId('study-card');

    await pulsar('back-to-deck');
    await screen.findByTestId('add-card-button');

    // Un único paso atrás más debe llevar a Mis mazos: el apilado es /, detalle.
    await pulsar('back-to-decks');

    expect(await screen.findByTestId('create-deck-button')).toBeTruthy();
    expect(router.canGoBack()).toBe(false);
  });

  it('se puede volver al mazo desde el estudio sin terminarlo', async () => {
    await prepararMazoConDosCartas();

    await pulsar('study-button');
    await screen.findByTestId('study-card');

    await pulsar('back-to-deck');

    expect(await screen.findByTestId('add-card-button')).toBeTruthy();
  });
});
