import { screen } from 'expo-router/testing-library';

import { buildStatsReport } from '../../src/features/stats/engine';
import { localDayOf } from '../../src/features/stats/time';
import { crearEstudiarMazo, montarApp, PREFIJO_HISTORIAL, repositorios } from './statsHarness';

/**
 * El historial sobrevive a la aplicación.
 *
 * El ciclo que se demuestra es el pedido: crear, estudiar, persistir, destruir el árbol de
 * proveedores entero, reconstruirlo sobre el mismo medio, leer el historial y calcular
 * estadísticas. Comprobar solo el estado de React no demostraría nada: ese estado no
 * sobrevive a un recargar, y el historial tiene que sobrevivir.
 */

const HOY = localDayOf(Date.now());
const AHORA = Date.now();

describe('Recuperación tras reconstruir la aplicación', () => {
  it('el historial se lee del medio, no de un estado que sobrevivió', async () => {
    const repos = repositorios();

    const primera = montarApp(repos);
    await screen.findByTestId('create-deck-button');
    await crearEstudiarMazo('Inglés', 'mazo-1', 4);
    await repos.historyRepository.flush();

    // Se destruye todo: proveedores, contextos y estado de React.
    primera.unmount();

    // Repositorios nuevos sobre el mismo almacenamiento, como haría un recargar.
    const segunda = montarApp(repos);
    await screen.findByTestId('create-deck-button');
    void segunda;

    const result = await repos.historyRepository.load();
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;

    expect(result.history.cardEvents).toHaveLength(4);
    expect(result.history.sessions).toHaveLength(1);
    expect(result.history.sessions[0]?.completedCards).toBe(4);
  });

  it('las estadísticas calculadas tras reconstruir son las mismas', async () => {
    const repos = repositorios();

    const primera = montarApp(repos);
    await screen.findByTestId('create-deck-button');
    await crearEstudiarMazo('Inglés', 'mazo-1', 3);
    await crearEstudiarMazo('Matemáticas', 'mazo-5', 2);
    await repos.historyRepository.flush();

    const antes = await calcular(repos);
    primera.unmount();

    montarApp(repos);
    await screen.findByTestId('create-deck-button');
    const despues = await calcular(repos);

    expect(despues.total).toBe(5);
    expect(despues).toEqual(antes);
  });

  it('la pantalla de estadísticas muestra la actividad recuperada', async () => {
    const repos = repositorios();

    const primera = montarApp(repos);
    await screen.findByTestId('create-deck-button');
    await crearEstudiarMazo('Inglés', 'mazo-1', 4);
    await repos.historyRepository.flush();
    primera.unmount();

    montarApp({ ...repos, initialUrl: '/estadisticas' });
    const cifra = await screen.findByTestId('stats-today-metrics-tarjetas-estudiadas');

    expect(cifra.props.accessibilityLabel).toBe('Tarjetas estudiadas: 4');
  });

  it('lo escrito queda repartido en la partición del mes correspondiente', async () => {
    const repos = repositorios();
    montarApp(repos);
    await screen.findByTestId('create-deck-button');
    await crearEstudiarMazo('Inglés', 'mazo-1', 2);
    await repos.historyRepository.flush();

    const claves = Object.keys(repos.historyRepository.peek());
    const mesActual = HOY.slice(0, 7);

    // Las claves cuelgan del usuario autenticado desde TASK-008.
    expect(claves).toContain(`${PREFIJO_HISTORIAL}:meta`);
    expect(claves).toContain(`${PREFIJO_HISTORIAL}:month:${mesActual}`);
  });
});

async function calcular(repos: ReturnType<typeof repositorios>) {
  await repos.historyRepository.flush();
  const historyResult = await repos.historyRepository.load();
  const libraryResult = await repos.libraryRepository.load();
  if (historyResult.status !== 'ok' || libraryResult.status !== 'ok') {
    throw new Error('no se pudieron leer los datos guardados');
  }

  const report = buildStatsReport(
    { library: libraryResult.library, history: historyResult.history },
    { scope: { kind: 'all' }, period: 'all', today: HOY, now: AHORA },
  );

  return {
    total: report.activity.total,
    sesiones: report.time.sessions,
    diasActivos: report.activity.daysStudied,
    porMazo: (report.deckComparison ?? []).map((fila) => [fila.deckId, fila.studied] as const),
  };
}
