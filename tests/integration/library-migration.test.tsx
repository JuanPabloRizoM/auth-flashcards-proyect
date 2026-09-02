import { screen } from 'expo-router/testing-library';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { newScheduling } from '../../src/features/scheduler/types';
import { buildStatsReport } from '../../src/features/stats/engine';
import { localDayOf } from '../../src/features/stats/time';
import { createTestClock } from '../../src/lib/clock';
import { createMemoryRepository } from '../../src/lib/storage/memoryRepository';
import { historyKeys } from '../../src/lib/storage/historySerialization';
import { createMemoryHistoryRepository } from '../../src/lib/storage/studyHistoryRepository';
import { montarApp, PREFIJO_HISTORIAL } from './statsHarness';

const claves = historyKeys(PREFIJO_HISTORIAL);

/**
 * Migración desde una instalación anterior a TASK-007.
 *
 * Los documentos de partida son archivos reales de `tests/fixtures/migration/`, escritos con
 * la forma exacta que tenían las versiones anteriores. Se montan en los repositorios con sus
 * claves de verdad, se arranca la aplicación entera, y se comprueba que **no se pierde nada**
 * y que **no se inventa nada**.
 */

const AHORA = '2026-08-23T12:00:00.000Z';

function fixture(nombre: string): string {
  return readFileSync(join(__dirname, '..', 'fixtures', 'migration', nombre), 'utf8');
}

function entornoAnterior() {
  return {
    clock: createTestClock(AHORA),
    libraryRepository: createMemoryRepository(fixture('library-v2.json')),
    historyRepository: createMemoryHistoryRepository(PREFIJO_HISTORIAL, {
      [claves.meta]: fixture('history-v1-meta.json'),
      [claves.month('2026-08')]: fixture('history-v1-month.json'),
    }),
  };
}

async function cargar(entorno: ReturnType<typeof entornoAnterior>) {
  const library = await entorno.libraryRepository.load();
  const history = await entorno.historyRepository.load();
  if (library.status !== 'ok') throw new Error(`biblioteca ilegible: ${library.status}`);
  if (history.status !== 'ok' && history.status !== 'partial') {
    throw new Error(`historial ilegible: ${history.status}`);
  }
  return { library: library.library, history: history.history };
}

describe('La biblioteca anterior se migra sin perder nada', () => {
  it('conserva los mazos con su nombre y su fecha de modificación', async () => {
    const { library } = await cargar(entornoAnterior());

    expect(library.decks).toEqual([
      { id: 'mazo-1', name: 'Inglés', updatedAt: '2026-08-20T10:00:00.000Z' },
      { id: 'mazo-2', name: 'Matemáticas', updatedAt: '2026-08-21T09:30:00.000Z' },
    ]);
  });

  it('conserva las cartas con su id, su mazo, su frente y su reverso', async () => {
    const { library } = await cargar(entornoAnterior());

    expect(
      library.cards.map(({ id, deckId, front, back }) => ({ id, deckId, front, back })),
    ).toEqual([
      { id: 'carta-1', deckId: 'mazo-1', front: 'to overlook', back: 'pasar por alto' },
      { id: 'carta-2', deckId: 'mazo-1', front: 'to withstand', back: 'resistir' },
      { id: 'carta-3', deckId: 'mazo-2', front: 'derivada de x²', back: '2x' },
    ]);
  });

  it('todas las cartas entran como Nueva para el scheduler', async () => {
    const { library } = await cargar(entornoAnterior());

    for (const card of library.cards) {
      expect(card.scheduling).toEqual(newScheduling);
    }
  });

  it('no se les inventa ninguna revisión ni ninguna calificación', async () => {
    const { library, history } = await cargar(entornoAnterior());

    for (const card of library.cards) {
      expect(card.scheduling.reps).toBe(0);
      expect(card.scheduling.lapses).toBe(0);
      expect(card.scheduling.lastReview).toBeNull();
      expect(card.scheduling.due).toBeNull();
    }
    expect(history.reviews).toEqual([]);
    expect(history.ratedSince).toBeNull();
  });

  it('la biblioteca no se resetea', async () => {
    const { library } = await cargar(entornoAnterior());

    expect(library.decks).toHaveLength(2);
    expect(library.cards).toHaveLength(3);
  });

  it('una biblioteca de la versión 1 también migra, con las dos cosas a la vez', async () => {
    const repositorio = createMemoryRepository(fixture('library-v1.json'));
    const result = await repositorio.load();

    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.library.decks[0]?.name).toBe('Inglés');
    expect(typeof result.library.decks[0]?.updatedAt).toBe('string');
    expect(result.library.cards[0]?.scheduling).toEqual(newScheduling);
  });
});

describe('El historial anterior se migra sin perder nada', () => {
  it('conserva sesiones, eventos y altas', async () => {
    const { history } = await cargar(entornoAnterior());

    expect(history.sessions).toHaveLength(2);
    expect(history.cardEvents).toHaveLength(3);
    expect(history.cardAdditions).toHaveLength(2);
  });

  it('conserva la fecha de inicio del tracking', async () => {
    const { history } = await cargar(entornoAnterior());

    expect(history.trackedSince).toBe(1786867200000);
  });

  it('conserva los snapshots de nombre, incluido el del mazo ya eliminado', async () => {
    const { history } = await cargar(entornoAnterior());

    expect(history.deckSnapshots).toHaveLength(2);
    expect(history.deckSnapshots.find((s) => s.deckId === 'mazo-borrado')?.name).toBe('Historia');
  });

  it('conserva el origen de las cartas importadas', async () => {
    const { history } = await cargar(entornoAnterior());

    expect(history.cardAdditions.map((alta) => alta.origin).sort()).toEqual(['csv', 'manual']);
  });

  it('la actividad anterior no se convierte en calificaciones', async () => {
    const { library, history } = await cargar(entornoAnterior());

    const report = buildStatsReport(
      { library, history },
      { scope: { kind: 'all' }, period: 'all', today: localDayOf(Date.parse(AHORA)), now: Date.parse(AHORA) },
    );

    // Tres cartas completadas en el historial…
    expect(report.activity.total).toBe(3);
    // …y ninguna calificación: no se reparten entre los cuatro botones.
    expect(report.answerButtons.total).toBe(0);
    expect(report.answerButtons.unrated).toBe(3);
    expect(report.trueRetention.rows.every((row) => row.total.retention === null)).toBe(true);
  });

  it('las estadísticas anteriores siguen contando exactamente igual que antes', async () => {
    const { library, history } = await cargar(entornoAnterior());

    const report = buildStatsReport(
      { library, history },
      { scope: { kind: 'all' }, period: 'all', today: localDayOf(Date.parse(AHORA)), now: Date.parse(AHORA) },
    );

    expect(report.time.totalMs).toBe(120_000);
    expect(report.time.sessions).toBe(2);
    expect(report.counts.total).toBe(3);
    expect(report.added.totalInPeriod).toBe(2);
    // El mazo eliminado sigue en las estadísticas globales históricas.
    expect(report.deckComparison?.map((row) => row.deckId)).toContain('mazo-borrado');
  });
});

describe('La aplicación arranca sobre los datos migrados', () => {
  it('muestra los mazos anteriores en Mis mazos', async () => {
    montarApp({ ...entornoAnterior(), initialUrl: '/' });

    expect(await screen.findByTestId('deck-mazo-1')).toBeTruthy();
    expect(screen.getByTestId('deck-mazo-2')).toBeTruthy();
  });

  it('el resumen del mazo cuenta las cartas migradas como Nuevas', async () => {
    montarApp({ ...entornoAnterior(), initialUrl: '/mazo/mazo-1' });
    await screen.findByTestId('deck-summary');

    const nuevas = String(screen.getByTestId('deck-summary-nuevas').props.accessibilityLabel);
    const repasar = String(screen.getByTestId('deck-summary-repasar').props.accessibilityLabel);

    expect(nuevas).toContain('2');
    expect(repasar).toContain('0');
  });

  it('las estadísticas se abren sin inventar datos de calificación', async () => {
    montarApp({ ...entornoAnterior(), initialUrl: '/estadisticas' });
    await screen.findByTestId('stats-counts-metrics');

    expect(screen.getByTestId('stats-answer-buttons-empty')).toBeTruthy();
    expect(screen.getByTestId('stats-retention-empty')).toBeTruthy();
  });
});
