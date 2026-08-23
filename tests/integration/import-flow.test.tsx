import { Slot } from 'expo-router';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import MisMazosScreen from '../../app/index';
import ImportarScreen from '../../app/mazo/[id]/importar';
import DetalleMazoScreen from '../../app/mazo/[id]/index';
import { AppShell } from '../../src/components/layout';
import type { FilePicker } from '../../src/lib/files/types';
import { LibraryProvider } from '../../src/lib/LibraryProvider';
import { parseStoredLibrary } from '../../src/lib/storage';
import {
  createMemoryRepository,
  createWriteFailingRepository,
} from '../../src/lib/storage/memoryRepository';
import type { LibraryRepository } from '../../src/lib/storage/types';
import type { Library } from '../../src/types/domain';
import { fixtureFile } from '../fixtures/import/load';

/**
 * El flujo de importación de punta a punta, con archivos reales del disco.
 *
 * Lo único que se sustituye es el selector del sistema, que no puede abrirse en un test: en
 * su lugar se inyecta uno que devuelve una fixture. Todo lo demás (parseo, detección, mapeo,
 * vista previa, escritura y rehidratación) es el código de producción.
 */

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

type Repositorio = ReturnType<typeof createMemoryRepository>;

/** Un selector que siempre devuelve la misma fixture. */
function selectorDe(nombre: string): FilePicker {
  return async () => ({ status: 'ok', file: fixtureFile(nombre) });
}

function montarApp(repository: LibraryRepository, filePicker: FilePicker, initialUrl = '/') {
  function Layout() {
    return (
      <SafeAreaProvider initialMetrics={metrics}>
        <LibraryProvider repository={repository}>
          <AppShell>
            <Slot />
          </AppShell>
        </LibraryProvider>
      </SafeAreaProvider>
    );
  }

  return renderRouter(
    {
      _layout: Layout,
      index: MisMazosScreen,
      'mazo/[id]/index': DetalleMazoScreen,
      'mazo/[id]/importar': () => <ImportarScreen filePicker={filePicker} />,
    },
    { initialUrl },
  );
}

function guardado(repository: Repositorio): Library {
  const result = parseStoredLibrary(repository.peek());
  if (result.status !== 'ok') {
    throw new Error(`el repositorio debería tener datos legibles, tiene ${result.status}`);
  }
  return result.library;
}

async function pulsar(testID: string) {
  await act(async () => {
    fireEvent.press(screen.getByTestId(testID));
  });
}

/** Crea un mazo y deja la pantalla de importación abierta sobre él. */
async function abrirImportacion(repository: LibraryRepository, filePicker: FilePicker) {
  const rendered = montarApp(repository, filePicker);
  await screen.findByTestId('create-deck-button');

  fireEvent.changeText(screen.getByTestId('deck-name-input'), 'Vocabulario');
  await act(async () => {
    fireEvent.press(screen.getByTestId('create-deck-button'));
  });
  await pulsar('deck-mazo-1');
  await screen.findByTestId('import-button');
  await pulsar('import-button');
  await screen.findByTestId('pick-file-button');

  return rendered;
}

describe('Importar un CSV', () => {
  it('elegir el archivo no importa nada por sí solo: primero hay vista previa', async () => {
    const repositorio = createMemoryRepository();
    await abrirImportacion(repositorio, selectorDe('simple.csv'));

    await pulsar('pick-file-button');

    // La detección ha reconocido Front y Back, y aun así no se ha creado ninguna carta.
    expect(await screen.findByTestId('import-preview')).toBeTruthy();
    expect(guardado(repositorio).cards).toEqual([]);
    expect(screen.getByTestId('confirm-import-button')).toBeTruthy();
  });

  it('anuncia cuántas tarjetas se importarán y enseña una muestra', async () => {
    await abrirImportacion(createMemoryRepository(), selectorDe('simple.csv'));
    await pulsar('pick-file-button');

    expect(await screen.findByText('Se importarán 3 tarjetas.')).toBeTruthy();
    expect(screen.getByText('Hello')).toBeTruthy();
    expect(screen.getByText('Hola')).toBeTruthy();
  });

  it('crea las tarjetas en el mazo elegido al confirmar', async () => {
    const repositorio = createMemoryRepository();
    await abrirImportacion(repositorio, selectorDe('simple.csv'));
    await pulsar('pick-file-button');
    await screen.findByTestId('confirm-import-button');

    await pulsar('confirm-import-button');

    expect(await screen.findByTestId('import-result')).toBeTruthy();
    const library = guardado(repositorio);
    expect(library.cards.map((card) => [card.front, card.back])).toEqual([
      ['Hello', 'Hola'],
      ['House', 'Casa'],
      ['Tree', 'Arbol'],
    ]);
    expect(library.cards.every((card) => card.deckId === 'mazo-1')).toBe(true);
  });

  it('las tarjetas importadas sobreviven a recrear el proveedor', async () => {
    const repositorio = createMemoryRepository();
    const { unmount } = await abrirImportacion(repositorio, selectorDe('simple.csv'));
    await pulsar('pick-file-button');
    await screen.findByTestId('confirm-import-button');
    await pulsar('confirm-import-button');
    await screen.findByTestId('import-result');

    unmount();
    montarApp(repositorio, selectorDe('simple.csv'), '/mazo/mazo-1');

    expect(await screen.findByText('Hello')).toBeTruthy();
    expect(screen.getByText('Casa')).toBeTruthy();
  });

  it('respeta las comas y las comillas de dentro de los campos', async () => {
    const repositorio = createMemoryRepository();
    await abrirImportacion(repositorio, selectorDe('comillas.csv'));
    await pulsar('pick-file-button');
    await screen.findByTestId('confirm-import-button');
    await pulsar('confirm-import-button');
    await screen.findByTestId('import-result');

    expect(guardado(repositorio).cards[0]).toMatchObject({
      front: 'Hola, ¿cómo estás?',
      back: 'Hello, how are you?',
    });
  });

  it('reconoce los encabezados Pregunta y Respuesta', async () => {
    const repositorio = createMemoryRepository();
    await abrirImportacion(repositorio, selectorDe('pregunta-respuesta.csv'));
    await pulsar('pick-file-button');
    await screen.findByTestId('confirm-import-button');
    await pulsar('confirm-import-button');
    await screen.findByTestId('import-result');

    expect(guardado(repositorio).cards[0]).toMatchObject({
      front: 'Capital de Francia',
      back: 'París',
    });
  });
});

describe('Cuando los encabezados no dicen nada', () => {
  it('no preselecciona nada y no deja importar hasta elegir las columnas', async () => {
    const repositorio = createMemoryRepository();
    await abrirImportacion(repositorio, selectorDe('desconocido.csv'));

    await pulsar('pick-file-button');

    expect(await screen.findByTestId('mapping-error')).toBeTruthy();
    expect(screen.queryByTestId('confirm-import-button')).toBeNull();
    expect(guardado(repositorio).cards).toEqual([]);
  });

  it('deja elegir las columnas a mano y entonces sí importa', async () => {
    const repositorio = createMemoryRepository();
    await abrirImportacion(repositorio, selectorDe('desconocido.csv'));
    await pulsar('pick-file-button');
    await screen.findByTestId('mapping-error');

    await pulsar('front-select-0');
    await pulsar('back-select-1');
    await pulsar('confirm-import-button');
    await screen.findByTestId('import-result');

    expect(guardado(repositorio).cards.map((card) => [card.front, card.back])).toEqual([
      ['Perro', 'Dog'],
      ['Gato', 'Cat'],
    ]);
  });

  it('permite invertir el mapeo y respeta lo elegido', async () => {
    const repositorio = createMemoryRepository();
    await abrirImportacion(repositorio, selectorDe('desconocido.csv'));
    await pulsar('pick-file-button');
    await screen.findByTestId('mapping-error');

    await pulsar('front-select-1');
    await pulsar('back-select-0');
    await pulsar('confirm-import-button');
    await screen.findByTestId('import-result');

    expect(guardado(repositorio).cards[0]).toMatchObject({ front: 'Dog', back: 'Perro' });
  });

  it('rechaza elegir la misma columna para las dos caras', async () => {
    const repositorio = createMemoryRepository();
    await abrirImportacion(repositorio, selectorDe('desconocido.csv'));
    await pulsar('pick-file-button');
    await screen.findByTestId('mapping-error');

    await pulsar('front-select-0');
    await pulsar('back-select-0');

    expect(
      await screen.findByText(
        'El frente y el reverso no pueden ser la misma columna. Elige dos columnas distintas.',
      ),
    ).toBeTruthy();
    expect(screen.queryByTestId('confirm-import-button')).toBeNull();
  });
});

describe('Importar un .xlsx', () => {
  it('con una sola hoja no pregunta por la hoja', async () => {
    await abrirImportacion(createMemoryRepository(), selectorDe('basico.xlsx'));
    await pulsar('pick-file-button');
    await screen.findByTestId('import-preview');

    expect(screen.queryByTestId('sheet-select')).toBeNull();
  });

  it('importa las filas de la única hoja', async () => {
    const repositorio = createMemoryRepository();
    await abrirImportacion(repositorio, selectorDe('basico.xlsx'));
    await pulsar('pick-file-button');
    await screen.findByTestId('confirm-import-button');
    await pulsar('confirm-import-button');
    await screen.findByTestId('import-result');

    expect(guardado(repositorio).cards.map((card) => card.back)).toEqual([
      'Hola',
      'Casa',
      'Árbol',
    ]);
  });

  it('con varias hojas deja elegir cuál, y cambiar de hoja recalcula el mapeo', async () => {
    const repositorio = createMemoryRepository();
    await abrirImportacion(repositorio, selectorDe('multihoja.xlsx'));
    await pulsar('pick-file-button');

    // Primera hoja: Question/Answer, reconocida.
    expect(await screen.findByTestId('sheet-select')).toBeTruthy();
    expect(screen.getByTestId('import-preview')).toBeTruthy();

    // Segunda hoja: Columna A/Columna B, que no dice nada y exige elegir a mano.
    await pulsar('sheet-select-1');

    expect(await screen.findByTestId('mapping-error')).toBeTruthy();
    expect(screen.queryByTestId('confirm-import-button')).toBeNull();
  });

  it('importa la hoja que se ha elegido, no la primera', async () => {
    const repositorio = createMemoryRepository();
    await abrirImportacion(repositorio, selectorDe('multihoja.xlsx'));
    await pulsar('pick-file-button');
    await screen.findByTestId('sheet-select');

    await pulsar('sheet-select-1');
    await screen.findByTestId('mapping-error');
    await pulsar('front-select-0');
    await pulsar('back-select-1');
    await pulsar('confirm-import-button');
    await screen.findByTestId('import-result');

    expect(guardado(repositorio).cards.map((card) => card.front)).toEqual(['1492', '1789']);
  });
});

describe('Importar un Markdown', () => {
  it('importa una tabla con encabezados Frente y Reverso', async () => {
    const repositorio = createMemoryRepository();
    await abrirImportacion(repositorio, selectorDe('tabla.md'));
    await pulsar('pick-file-button');
    await screen.findByTestId('confirm-import-button');
    await pulsar('confirm-import-button');
    await screen.findByTestId('import-result');

    expect(guardado(repositorio).cards.map((card) => [card.front, card.back])).toEqual([
      ['Perro', 'Dog'],
      ['Gato', 'Cat'],
    ]);
  });

  it('importa una tabla Question/Answer rodeada de prosa, sin llevarse la prosa', async () => {
    const repositorio = createMemoryRepository();
    await abrirImportacion(repositorio, selectorDe('tabla-question.md'));
    await pulsar('pick-file-button');
    await screen.findByTestId('confirm-import-button');
    await pulsar('confirm-import-button');
    await screen.findByTestId('import-result');

    expect(guardado(repositorio).cards.map((card) => card.front)).toEqual([
      'Capital de España',
      'Capital de Italia',
    ]);
  });

  it('no convierte en tarjetas un Markdown que no tiene tabla', async () => {
    const repositorio = createMemoryRepository();
    await abrirImportacion(repositorio, selectorDe('sin-tabla.md'));

    await pulsar('pick-file-button');

    expect(await screen.findByTestId('import-error')).toBeTruthy();
    expect(guardado(repositorio).cards).toEqual([]);
  });
});

describe('Archivos que no valen', () => {
  it('avisa de un archivo vacío sin romper nada', async () => {
    const repositorio = createMemoryRepository();
    await abrirImportacion(repositorio, selectorDe('vacio.csv'));

    await pulsar('pick-file-button');

    expect(await screen.findByText('El archivo está vacío.')).toBeTruthy();
    expect(guardado(repositorio).cards).toEqual([]);
  });

  it('avisa de un .xlsx dañado sin romper nada', async () => {
    const repositorio = createMemoryRepository();
    await abrirImportacion(repositorio, selectorDe('roto.xlsx'));

    await pulsar('pick-file-button');

    expect(await screen.findByTestId('import-error')).toBeTruthy();
    expect(guardado(repositorio).cards).toEqual([]);
  });

  it('avisa de un archivo que solo tiene encabezados', async () => {
    await abrirImportacion(createMemoryRepository(), selectorDe('solo-encabezados.csv'));

    await pulsar('pick-file-button');

    expect(await screen.findByText('El archivo tiene encabezados pero ninguna fila de datos.'))
      .toBeTruthy();
  });

  it('cancelar el selector deja la pantalla como estaba', async () => {
    const cancelador: FilePicker = async () => ({ status: 'canceled' });
    await abrirImportacion(createMemoryRepository(), cancelador);

    await pulsar('pick-file-button');

    expect(screen.queryByTestId('import-error')).toBeNull();
    expect(screen.queryByTestId('import-preview')).toBeNull();
    expect(screen.getByTestId('pick-file-button')).toBeTruthy();
  });
});

describe('Filas parcialmente inválidas', () => {
  it('dice cuántas valen y cuántas tienen problemas antes de confirmar', async () => {
    await abrirImportacion(createMemoryRepository(), selectorDe('parcial.csv'));

    await pulsar('pick-file-button');

    expect(
      await screen.findByText(
        'Se importarán 2 tarjetas. 2 filas se descartarán por tener el frente o el reverso vacío.',
      ),
    ).toBeTruthy();
    expect(screen.getByTestId('import-issues')).toBeTruthy();
  });

  it('importa solo las válidas y no convierte en tarjeta ninguna fila vacía', async () => {
    const repositorio = createMemoryRepository();
    await abrirImportacion(repositorio, selectorDe('parcial.csv'));
    await pulsar('pick-file-button');
    await screen.findByTestId('confirm-import-button');

    await pulsar('confirm-import-button');
    await screen.findByTestId('import-result');

    expect(guardado(repositorio).cards.map((card) => card.front)).toEqual(['Hello', 'Bird']);
  });

  it('el resultado enumera cuántas filas se descartaron', async () => {
    await abrirImportacion(createMemoryRepository(), selectorDe('parcial.csv'));
    await pulsar('pick-file-button');
    await screen.findByTestId('confirm-import-button');
    await pulsar('confirm-import-button');

    expect(
      await screen.findByText(
        'Se han importado 2 tarjetas. 2 filas se han descartado por tener el frente o el reverso vacío.',
      ),
    ).toBeTruthy();
  });
});

describe('Un fallo de escritura no corrompe nada', () => {
  it('avisa y no deja el mazo con tarjetas a medias', async () => {
    // Este repositorio lee bien pero revienta siempre al guardar.
    const repositorio: LibraryRepository = createWriteFailingRepository();
    montarApp(repositorio, selectorDe('simple.csv'), '/');
    await screen.findByTestId('create-deck-button');

    fireEvent.changeText(screen.getByTestId('deck-name-input'), 'Vocabulario');
    await act(async () => {
      fireEvent.press(screen.getByTestId('create-deck-button'));
    });
    await pulsar('deck-mazo-1');
    await pulsar('import-button');
    await screen.findByTestId('pick-file-button');
    await pulsar('pick-file-button');
    await screen.findByTestId('confirm-import-button');

    await pulsar('confirm-import-button');

    expect(await screen.findByTestId('import-error')).toBeTruthy();
    expect(screen.queryByTestId('import-result')).toBeNull();
  });

  it('deja intactas las tarjetas que ya había', async () => {
    let fallar = false;
    const base = createMemoryRepository();
    const repositorio: LibraryRepository = {
      load: base.load,
      save: async (library) => {
        if (fallar) {
          throw new Error('el medio se ha caído');
        }
        return base.save(library);
      },
    };

    montarApp(repositorio, selectorDe('simple.csv'), '/');
    await screen.findByTestId('create-deck-button');
    fireEvent.changeText(screen.getByTestId('deck-name-input'), 'Vocabulario');
    await act(async () => {
      fireEvent.press(screen.getByTestId('create-deck-button'));
    });
    await pulsar('deck-mazo-1');
    fireEvent.changeText(screen.getByTestId('card-front-input'), 'carta previa');
    fireEvent.changeText(screen.getByTestId('card-back-input'), 'sigue aquí');
    await act(async () => {
      fireEvent.press(screen.getByTestId('add-card-button'));
    });
    const antes = base.peek();

    // A partir de aquí, cualquier escritura falla.
    fallar = true;
    await pulsar('import-button');
    await screen.findByTestId('pick-file-button');
    await pulsar('pick-file-button');
    await screen.findByTestId('confirm-import-button');
    await pulsar('confirm-import-button');
    await screen.findByTestId('import-error');

    // Lo guardado es byte a byte lo que había antes del intento.
    expect(base.peek()).toBe(antes);
    expect(guardado(base).cards.map((card) => card.front)).toEqual(['carta previa']);
  });
});
