import { screen } from 'expo-router/testing-library';

import type { CardOrigin } from '../../src/features/stats/types';
import type { FilePicker } from '../../src/lib/files/types';
import { fixtureFile } from '../fixtures/import/load';
import { anadirCarta, crearMazo, irA, montarApp, repositorios } from './statsHarness';

/**
 * Origen de las tarjetas importadas.
 *
 * Se importa cada formato con un archivo real del disco y se comprueba que el alta queda
 * registrada con el origen que corresponde. El origen sale de la extensión del archivo
 * elegido, que es lo único que se sabe de verdad; lo que no se reconoce no se inventa.
 */

function selectorDe(nombre: string): FilePicker {
  return async () => ({ status: 'ok', file: fixtureFile(nombre) });
}

async function importar(fixture: string) {
  const repos = repositorios();
  montarApp({ ...repos, filePicker: selectorDe(fixture) });
  await screen.findByTestId('create-deck-button');

  await crearMazo('Vocabulario');
  await irA('deck-mazo-1');
  await screen.findByTestId('import-button');
  await irA('import-button');
  await screen.findByTestId('pick-file-button');
  await irA('pick-file-button');
  await screen.findByTestId('confirm-import-button');
  await irA('confirm-import-button');
  await screen.findByTestId('import-result');

  await repos.historyRepository.flush();
  const result = await repos.historyRepository.load();
  if (result.status !== 'ok') throw new Error('historial ilegible');
  return result.history;
}

describe('Cada formato registra su origen', () => {
  const casos: readonly [string, string, CardOrigin][] = [
    ['CSV', 'simple.csv', 'csv'],
    ['XLSX', 'basico.xlsx', 'xlsx'],
    ['Markdown', 'tabla.md', 'markdown'],
  ];

  it.each(casos)('importar %s registra las altas con origen "%s"', async (_formato, fixture, origen) => {
    const history = await importar(fixture);

    expect(history.cardAdditions.length).toBeGreaterThan(0);
    expect(history.cardAdditions.every((alta) => alta.origin === origen)).toBe(true);
    expect(history.cardAdditions.every((alta) => alta.deckId === 'mazo-1')).toBe(true);
    // Cada alta apunta a una carta distinta, con su identificador real.
    const ids = new Set(history.cardAdditions.map((alta) => alta.cardId));
    expect(ids.size).toBe(history.cardAdditions.length);
  });

  it('el origen se refleja en la distribución de la pantalla', async () => {
    const repos = repositorios();
    montarApp({ ...repos, filePicker: selectorDe('simple.csv') });
    await screen.findByTestId('create-deck-button');

    await crearMazo('Vocabulario');
    await irA('deck-mazo-1');
    await screen.findByTestId('import-button');
    await irA('import-button');
    await screen.findByTestId('pick-file-button');
    await irA('pick-file-button');
    await screen.findByTestId('confirm-import-button');
    await irA('confirm-import-button');
    await screen.findByTestId('import-result');

    await irA('nav-estadisticas');
    await screen.findByTestId('stats-origin-table');

    const filaCsv = String(
      screen.getByTestId('stats-origin-table-fila-csv').props.accessibilityLabel,
    );
    expect(filaCsv).toContain('CSV:');
    expect(filaCsv).toContain('100 %');

    // Ningún otro origen se lleva nada: el reparto no se inventa.
    for (const otro of ['manual', 'xlsx', 'markdown']) {
      expect(
        String(screen.getByTestId(`stats-origin-table-fila-${otro}`).props.accessibilityLabel),
      ).toContain('0 tarjetas');
    }
  });
});

describe('Tarjetas sin origen conocido', () => {
  it('las anteriores al tracking se declaran desconocidas, no se reparten', async () => {
    const repos = repositorios();
    // Biblioteca ya guardada, como la de quien viene de una versión anterior.
    await repos.libraryRepository.save({
      decks: [{ id: 'mazo-9', name: 'Anterior', updatedAt: '2026-01-01T00:00:00.000Z' }],
      cards: [
        { id: 'carta-90', deckId: 'mazo-9', front: 'a', back: 'b' },
        { id: 'carta-91', deckId: 'mazo-9', front: 'c', back: 'd' },
        { id: 'carta-92', deckId: 'mazo-9', front: 'e', back: 'f' },
      ],
    });

    montarApp({ ...repos, initialUrl: '/estadisticas' });
    await screen.findByTestId('stats-origin-table');

    const desconocido = String(
      screen.getByTestId('stats-origin-table-fila-desconocido').props.accessibilityLabel,
    );

    expect(desconocido).toContain('Origen desconocido / anterior al tracking');
    expect(desconocido).toContain('3 tarjetas');
    expect(desconocido).toContain('100 %');
  });

  it('se cuentan como baseline y no reciben una fecha de alta falsa', async () => {
    const repos = repositorios();
    await repos.libraryRepository.save({
      decks: [{ id: 'mazo-9', name: 'Anterior', updatedAt: '2026-01-01T00:00:00.000Z' }],
      cards: [
        { id: 'carta-90', deckId: 'mazo-9', front: 'a', back: 'b' },
        { id: 'carta-91', deckId: 'mazo-9', front: 'c', back: 'd' },
      ],
    });

    montarApp({ ...repos, initialUrl: '/estadisticas' });
    await screen.findByTestId('stats-added-metrics-anteriores-al-tracking');

    expect(
      String(
        screen.getByTestId('stats-added-metrics-anteriores-al-tracking').props.accessibilityLabel,
      ),
    ).toBe('Anteriores al tracking: 2');
    expect(
      String(
        screen.getByTestId('stats-added-metrics-anadidas-en-el-periodo').props.accessibilityLabel,
      ),
    ).toBe('Añadidas en el periodo: 0');
    // La gráfica de añadidas no dibuja nada: no hay ninguna alta con fecha.
    expect(screen.getByTestId('stats-added-chart-empty')).toBeTruthy();
  });

  it('una carta creada a mano sí pasa a contarse como añadida', async () => {
    const repos = repositorios();
    montarApp(repos);
    await screen.findByTestId('create-deck-button');

    await crearMazo('Inglés');
    await irA('deck-mazo-1');
    await screen.findByTestId('add-card-button');
    await anadirCarta('to overlook', 'pasar por alto');

    await irA('nav-estadisticas');
    await screen.findByTestId('stats-added-metrics-anadidas-en-el-periodo');

    expect(
      String(
        screen.getByTestId('stats-added-metrics-anadidas-en-el-periodo').props.accessibilityLabel,
      ),
    ).toBe('Añadidas en el periodo: 1');
    expect(
      String(screen.getByTestId('stats-origin-table-fila-manual').props.accessibilityLabel),
    ).toContain('1 tarjeta');
  });
});
