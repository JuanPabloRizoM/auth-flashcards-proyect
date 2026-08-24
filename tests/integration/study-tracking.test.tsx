import { act, fireEvent, screen } from 'expo-router/testing-library';

import type { StudyHistory } from '../../src/features/stats/types';
import {
  abrirMazo,
  anadirCarta,
  crearEstudiarMazo,
  crearMazo,
  estudiarMazo,
  irA,
  montarApp,
  repositorios,
} from './statsHarness';

/**
 * Registro real de la actividad de estudio.
 *
 * Se conduce la aplicación por la interfaz y después se lee el historial del repositorio,
 * no del estado de React: lo que se demuestra es que estudiar produce eventos guardados.
 */

async function leerHistorial(repository: ReturnType<typeof repositorios>['historyRepository']) {
  // Registrar no bloquea la interfaz, así que hay que esperar a que la cola de escritura
  // termine antes de leer el medio. Es también la comprobación de que todo lo registrado
  // acaba escrito, y no solo lo que dio tiempo.
  await repository.flush();
  const result = await repository.load();
  if (result.status !== 'ok' && result.status !== 'partial') {
    throw new Error(`El historial no se pudo leer: ${result.status}`);
  }
  return result.history;
}

function eventosDe(history: StudyHistory, deckId: string) {
  return history.cardEvents.filter((event) => event.deckId === deckId);
}

describe('Una sesión de estudio produce historial', () => {
  it('registra la sesión y un evento completo por cada carta', async () => {
    const repos = repositorios();
    montarApp(repos);
    await screen.findByTestId('create-deck-button');

    await crearEstudiarMazo('Inglés', 'mazo-1', 3);

    const history = await leerHistorial(repos.historyRepository);

    expect(history.sessions).toHaveLength(1);
    expect(history.sessions[0]).toMatchObject({
      deckId: 'mazo-1',
      completedCards: 3,
    });
    expect(history.sessions[0]?.endedAt).not.toBeNull();

    const eventos = eventosDe(history, 'mazo-1');
    expect(eventos).toHaveLength(3);
    for (const evento of eventos) {
      expect(evento.sessionId).toBe(history.sessions[0]?.id);
      expect(evento.cardId).toMatch(/^carta-/);
      expect(evento.shownAt).toEqual(expect.any(Number));
      expect(evento.revealedAt).toEqual(expect.any(Number));
      expect(evento.completedAt).toEqual(expect.any(Number));
      expect(evento.localDay).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(evento.localHour).toBeGreaterThanOrEqual(0);
      expect(evento.localHour).toBeLessThan(24);
    }
  });

  it('el orden de los instantes es el del ciclo: mostrar, revelar y completar', async () => {
    const repos = repositorios();
    montarApp(repos);
    await screen.findByTestId('create-deck-button');

    await crearEstudiarMazo('Inglés', 'mazo-1', 2);

    const [evento] = eventosDe(await leerHistorial(repos.historyRepository), 'mazo-1');
    expect(evento).toBeDefined();
    expect(evento!.shownAt).toBeLessThanOrEqual(evento!.revealedAt!);
    expect(evento!.revealedAt!).toBeLessThanOrEqual(evento!.completedAt!);
  });

  it('la duración de la sesión es la suma de las de sus cartas', async () => {
    const repos = repositorios();
    montarApp(repos);
    await screen.findByTestId('create-deck-button');

    await crearEstudiarMazo('Inglés', 'mazo-1', 3);

    const history = await leerHistorial(repos.historyRepository);
    const suma = eventosDe(history, 'mazo-1').reduce((total, event) => total + event.activeMs, 0);

    expect(history.sessions[0]?.activeMs).toBe(suma);
  });

  it('un mazo sin cartas no abre ninguna sesión', async () => {
    const repos = repositorios();
    // El botón Estudiar está desactivado sin cartas, así que se llega por enlace directo,
    // que es la otra forma real de aterrizar en la pantalla de estudio.
    await repos.libraryRepository.save({
      decks: [{ id: 'mazo-1', name: 'Vacío', updatedAt: '2026-08-01T00:00:00.000Z' }],
      cards: [],
    });
    montarApp({ ...repos, initialUrl: '/mazo/mazo-1/estudiar' });
    await screen.findByTestId('study-empty');

    const history = await leerHistorial(repos.historyRepository);
    expect(history.sessions).toHaveLength(0);
    expect(history.cardEvents).toHaveLength(0);
  });
});

describe('Varias sesiones y varios mazos', () => {
  it('dos sesiones sobre el mismo mazo se registran por separado', async () => {
    const repos = repositorios();
    montarApp(repos);
    await screen.findByTestId('create-deck-button');

    await crearEstudiarMazo('Inglés', 'mazo-1', 2);
    // Se vuelve al mazo y se estudia otra vez.
    await irA('finish-back-button');
    await screen.findByTestId('study-button');
    await estudiarMazo(2);

    const history = await leerHistorial(repos.historyRepository);
    const ids = new Set(history.sessions.map((session) => session.id));

    expect(history.sessions).toHaveLength(2);
    expect(ids.size).toBe(2);
    expect(history.cardEvents).toHaveLength(4);
    // Cada evento pertenece a una de las dos sesiones y a ninguna otra.
    expect(history.cardEvents.every((event) => ids.has(event.sessionId))).toBe(true);
  });

  it('cada mazo registra su actividad con su propio identificador', async () => {
    const repos = repositorios();
    montarApp(repos);
    await screen.findByTestId('create-deck-button');

    await crearEstudiarMazo('Inglés', 'mazo-1', 2);
    await crearEstudiarMazo('Matemáticas', 'mazo-4', 3);

    const history = await leerHistorial(repos.historyRepository);

    expect(eventosDe(history, 'mazo-1')).toHaveLength(2);
    expect(eventosDe(history, 'mazo-4')).toHaveLength(3);
    expect(history.sessions.map((session) => session.deckId).sort()).toEqual([
      'mazo-1',
      'mazo-4',
    ]);
  });
});

describe('Inicio del tracking', () => {
  it('se fija al arrancar y no hay nada anterior', async () => {
    const antes = Date.now();
    const repos = repositorios();
    montarApp(repos);
    await screen.findByTestId('create-deck-button');

    const history = await leerHistorial(repos.historyRepository);
    const despues = Date.now();

    expect(history.trackedSince).toBeGreaterThanOrEqual(antes);
    expect(history.trackedSince).toBeLessThanOrEqual(despues);
    expect(history.cardEvents).toHaveLength(0);
    expect(history.cardAdditions).toHaveLength(0);
  });

  it('no se mueve al volver a arrancar sobre el mismo historial', async () => {
    const repos = repositorios();
    const primera = montarApp(repos);
    await screen.findByTestId('create-deck-button');
    const inicial = (await leerHistorial(repos.historyRepository)).trackedSince;
    primera.unmount();

    montarApp(repos);
    await screen.findByTestId('create-deck-button');

    expect((await leerHistorial(repos.historyRepository)).trackedSince).toBe(inicial);
  });

  it('las cartas anteriores al tracking no reciben una fecha de alta inventada', async () => {
    // Se prepara una biblioteca ya guardada, como la de quien viene de una versión previa.
    const repos = repositorios();
    await repos.libraryRepository.save({
      decks: [{ id: 'mazo-9', name: 'Anterior', updatedAt: '2026-01-01T00:00:00.000Z' }],
      cards: [
        { id: 'carta-90', deckId: 'mazo-9', front: 'a', back: 'b' },
        { id: 'carta-91', deckId: 'mazo-9', front: 'c', back: 'd' },
      ],
    });

    montarApp(repos);
    await screen.findByTestId('create-deck-button');

    const history = await leerHistorial(repos.historyRepository);
    expect(history.cardAdditions).toHaveLength(0);
  });
});

describe('Altas de tarjetas', () => {
  it('crear una carta a mano registra su alta con origen manual', async () => {
    const repos = repositorios();
    montarApp(repos);
    await screen.findByTestId('create-deck-button');

    await crearMazo('Inglés');
    await abrirMazo('mazo-1');
    await anadirCarta('to overlook', 'pasar por alto');

    const history = await leerHistorial(repos.historyRepository);

    expect(history.cardAdditions).toHaveLength(1);
    expect(history.cardAdditions[0]).toMatchObject({
      deckId: 'mazo-1',
      cardId: 'carta-2',
      origin: 'manual',
    });
    expect(history.cardAdditions[0]?.localDay).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('una carta rechazada no registra alta', async () => {
    const repos = repositorios();
    montarApp(repos);
    await screen.findByTestId('create-deck-button');

    await crearMazo('Inglés');
    await abrirMazo('mazo-1');
    await anadirCarta('   ', 'sin frente');

    expect((await leerHistorial(repos.historyRepository)).cardAdditions).toHaveLength(0);
  });
});

describe('Snapshot del mazo', () => {
  it('renombrar actualiza el nombre guardado sin crear un historial nuevo', async () => {
    const repos = repositorios();
    montarApp(repos);
    await screen.findByTestId('create-deck-button');

    await crearEstudiarMazo('Inglés', 'mazo-1', 2);
    await irA('finish-back-button');
    await irA('back-to-decks');
    await abrirMazo('mazo-1');

    // Renombrar el mazo por la interfaz real.
    await irA('rename-deck-button');
    const input = await screen.findByTestId('rename-deck-input');
    fireEvent.changeText(input, 'English');
    await act(async () => {
      fireEvent.press(screen.getByTestId('rename-deck-save'));
    });

    const history = await leerHistorial(repos.historyRepository);
    const snapshot = history.deckSnapshots.find((entry) => entry.deckId === 'mazo-1');

    expect(snapshot?.name).toBe('English');
    // Un solo historial, el del mismo id: la identidad no es el nombre.
    expect(history.deckSnapshots.filter((entry) => entry.deckId === 'mazo-1')).toHaveLength(1);
    expect(eventosDe(history, 'mazo-1')).toHaveLength(2);
  });
});
