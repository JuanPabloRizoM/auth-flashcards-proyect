import { act, fireEvent, screen } from 'expo-router/testing-library';

import { emptyLibrary } from '../../src/features/decks/library';
import { buildStatsReport } from '../../src/features/stats/engine';
import { localDayOf } from '../../src/features/stats/time';
import {
  cifra,
  crearEstudiarMazo,
  irA,
  montarApp,
  repositorios,
} from './statsHarness';

/**
 * Borrado y estadísticas.
 *
 * El caso obligatorio: se crea un mazo, se estudian sus cartas, se elimina el mazo, y las
 * estadísticas históricas no cambian. Eliminar vacía la biblioteca; el historial es otra
 * cosa y no se toca (docs/PRODUCT.md, 2026-08-23).
 */

const HOY = localDayOf(Date.now());

async function eliminarMazoAbierto() {
  await irA('delete-deck-button');
  await screen.findByTestId('delete-confirm-confirm');
  await act(async () => {
    fireEvent.press(screen.getByTestId('delete-confirm-confirm'));
  });
}

async function informeGlobal(repos: ReturnType<typeof repositorios>) {
  await repos.historyRepository.flush();
  const history = await repos.historyRepository.load();
  const library = await repos.libraryRepository.load();
  if (history.status !== 'ok') throw new Error('historial ilegible');

  return buildStatsReport(
    {
      library: library.status === 'ok' ? library.library : emptyLibrary,
      history: history.history,
    },
    { scope: { kind: 'all' }, period: 'all', today: HOY, now: Date.now() },
  );
}

describe('Eliminar un mazo conserva su historial', () => {
  it('la biblioteca se vacía y el historial permanece', async () => {
    const repos = repositorios();
    montarApp(repos);
    await screen.findByTestId('create-deck-button');

    await crearEstudiarMazo('Inglés', 'mazo-1', 10);
    const antes = await informeGlobal(repos);
    expect(antes.activity.total).toBe(10);

    await irA('finish-back-button');
    await screen.findByTestId('delete-deck-button');
    await eliminarMazoAbierto();
    await screen.findByTestId('create-deck-button');

    // Biblioteca: el mazo y sus cartas ya no están.
    const library = await repos.libraryRepository.load();
    expect(library.status).toBe('ok');
    expect(library.status === 'ok' && library.library.decks).toEqual([]);
    expect(library.status === 'ok' && library.library.cards).toEqual([]);

    // Historial: intacto.
    const despues = await informeGlobal(repos);
    expect(despues.activity.total).toBe(10);
    expect(despues.time.totalMs).toBe(antes.time.totalMs);
    expect(despues.time.sessions).toBe(antes.time.sessions);
  });

  it('las estadísticas globales no cambian retroactivamente', async () => {
    const repos = repositorios();
    montarApp(repos);
    await screen.findByTestId('create-deck-button');

    await crearEstudiarMazo('Inglés', 'mazo-1', 4);
    await crearEstudiarMazo('Matemáticas', 'mazo-6', 6);

    const antes = await informeGlobal(repos);

    await irA('finish-back-button');
    await screen.findByTestId('delete-deck-button');
    await eliminarMazoAbierto();
    await screen.findByTestId('create-deck-button');

    const despues = await informeGlobal(repos);

    expect(despues.activity.total).toBe(antes.activity.total);
    expect(despues.activity.total).toBe(10);
    expect(despues.time.totalMs).toBe(antes.time.totalMs);
    expect(despues.streak).toEqual(antes.streak);
    expect(despues.hourly.total).toBe(antes.hourly.total);
  });

  it('la identidad histórica sigue siendo atribuible al mazo eliminado', async () => {
    const repos = repositorios();
    montarApp(repos);
    await screen.findByTestId('create-deck-button');

    await crearEstudiarMazo('Inglés', 'mazo-1', 3);
    await irA('finish-back-button');
    await screen.findByTestId('delete-deck-button');
    await eliminarMazoAbierto();
    await screen.findByTestId('create-deck-button');

    const fila = (await informeGlobal(repos)).deckComparison?.find(
      (entrada) => entrada.deckId === 'mazo-1',
    );

    expect(fila).toBeDefined();
    expect(fila?.studied).toBe(3);
    // Se nombra por su snapshot y se dice que está eliminado. Nunca aparenta seguir vivo.
    expect(fila?.name).toBe('Inglés');
    expect(fila?.deleted).toBe(true);
  });

  it('la pantalla marca el mazo eliminado y no lo ofrece en el selector', async () => {
    const repos = repositorios();
    montarApp(repos);
    await screen.findByTestId('create-deck-button');

    await crearEstudiarMazo('Inglés', 'mazo-1', 3);
    await irA('finish-back-button');
    await screen.findByTestId('delete-deck-button');
    await eliminarMazoAbierto();
    await screen.findByTestId('create-deck-button');

    await irA('nav-estadisticas');
    await screen.findByTestId('stats-scope');

    // Sigue contando en el total global.
    expect(cifra('stats-today-metrics-tarjetas-estudiadas')).toBe('3');
    // Aparece en la comparación, etiquetado.
    expect(
      String(screen.getByTestId('stats-decks-table-fila-mazo-1').props.accessibilityLabel),
    ).toContain('Inglés (eliminado)');
    // Y no vuelve a la biblioteca: no se puede seleccionar como ámbito.
    expect(screen.queryByTestId('stats-scope-mazo-1')).toBeNull();
  });

  it('el historial sobrevive también a reconstruir la aplicación tras el borrado', async () => {
    const repos = repositorios();
    const primera = montarApp(repos);
    await screen.findByTestId('create-deck-button');

    await crearEstudiarMazo('Inglés', 'mazo-1', 5);
    await irA('finish-back-button');
    await screen.findByTestId('delete-deck-button');
    await eliminarMazoAbierto();
    await screen.findByTestId('create-deck-button');
    await repos.historyRepository.flush();
    primera.unmount();

    montarApp({ ...repos, initialUrl: '/estadisticas' });
    await screen.findByTestId('stats-scope');

    expect(cifra('stats-today-metrics-tarjetas-estudiadas')).toBe('5');
  });
});

describe('Eliminar una carta conserva su historial', () => {
  it('los eventos de la carta borrada siguen contando', async () => {
    const repos = repositorios();
    montarApp(repos);
    await screen.findByTestId('create-deck-button');

    await crearEstudiarMazo('Inglés', 'mazo-1', 3);
    const antes = await informeGlobal(repos);
    expect(antes.activity.total).toBe(3);

    // Volver de estudiar deja ya abierto el detalle del mazo, con su lista de cartas.
    await irA('finish-back-button');
    await screen.findByTestId('delete-card-carta-2');
    await irA('delete-card-carta-2');
    await screen.findByTestId('delete-confirm-confirm');
    await act(async () => {
      fireEvent.press(screen.getByTestId('delete-confirm-confirm'));
    });

    const despues = await informeGlobal(repos);

    // La carta ya no está en la biblioteca…
    expect(despues.counts.total).toBe(2);
    // …pero su repaso sigue en el historial.
    expect(despues.activity.total).toBe(3);
    expect(despues.time.totalMs).toBe(antes.time.totalMs);
  });
});
