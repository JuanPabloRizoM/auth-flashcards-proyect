import { Slot } from 'expo-router';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import ComponentesScreen from '../../app/componentes';
import MisMazosScreen from '../../app/index';
import EstudiarScreen from '../../app/mazo/[id]/estudiar';
import DetalleMazoScreen from '../../app/mazo/[id]/index';
import { AppShell } from '../../src/components/layout';
import { LibraryProvider } from '../../src/lib/LibraryProvider';
import { parseStoredLibrary } from '../../src/lib/storage';
import { createMemoryRepository } from '../../src/lib/storage/memoryRepository';
import type { Library } from '../../src/types/domain';

/**
 * Editar y eliminar mazos y cartas, comprobado contra el almacenamiento de verdad.
 *
 * Cada caso hace la operación, tira el proveedor entero, monta uno nuevo con el mismo
 * repositorio y vuelve a mirar. Si algo solo hubiera cambiado en el estado de React y no en
 * el medio, el segundo montaje lo delataría.
 */

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

type Repositorio = ReturnType<typeof createMemoryRepository>;

function montarApp(repository: Repositorio, initialUrl = '/') {
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
      componentes: ComponentesScreen,
      'mazo/[id]/index': DetalleMazoScreen,
      'mazo/[id]/estudiar': EstudiarScreen,
    },
    { initialUrl },
  );
}

/** Lo que hay guardado ahora mismo en el medio, no lo que la pantalla cree que hay. */
function guardado(repository: Repositorio): Library {
  const result = parseStoredLibrary(repository.peek());
  if (result.status !== 'ok') {
    throw new Error(`el repositorio debería tener datos legibles, tiene ${result.status}`);
  }
  return result.library;
}

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

async function anadirCarta(front: string, back: string) {
  fireEvent.changeText(screen.getByTestId('card-front-input'), front);
  fireEvent.changeText(screen.getByTestId('card-back-input'), back);
  await act(async () => {
    fireEvent.press(screen.getByTestId('add-card-button'));
  });
}

async function pulsar(testID: string) {
  await act(async () => {
    fireEvent.press(screen.getByTestId(testID));
  });
}

/** Deja montado el escenario del enunciado y devuelve el repositorio ya poblado. */
async function escenarioAB(): Promise<Repositorio> {
  const repositorio = createMemoryRepository();
  montarApp(repositorio);
  await screen.findByTestId('create-deck-button');

  await crearMazo('Mazo A');
  await abrirMazo('mazo-1');
  await anadirCarta('Carta 1', 'Uno');
  await anadirCarta('Carta 2', 'Dos');
  await pulsar('back-to-decks');
  await screen.findByTestId('decks-list');

  await crearMazo('Mazo B');
  await abrirMazo('mazo-4');
  await anadirCarta('Carta 3', 'Tres');

  return repositorio;
}

describe('Renombrar un mazo', () => {
  it('guarda el nombre nuevo y sobrevive a recrear el proveedor', async () => {
    const repositorio = createMemoryRepository();
    const { unmount } = montarApp(repositorio);
    await screen.findByTestId('create-deck-button');
    await crearMazo('Ingles');
    await abrirMazo('mazo-1');

    await pulsar('rename-deck-button');
    fireEvent.changeText(await screen.findByTestId('rename-deck-input'), 'Inglés');
    await pulsar('rename-deck-save');

    expect(guardado(repositorio).decks[0]?.name).toBe('Inglés');

    unmount();
    montarApp(repositorio, '/mazo/mazo-1');

    expect(await screen.findByText('Inglés')).toBeTruthy();
  });

  it('conserva las cartas del mazo, que sigue siendo el mismo', async () => {
    const repositorio = createMemoryRepository();
    montarApp(repositorio);
    await screen.findByTestId('create-deck-button');
    await crearMazo('Ingles');
    await abrirMazo('mazo-1');
    await anadirCarta('to overlook', 'pasar por alto');

    await pulsar('rename-deck-button');
    fireEvent.changeText(await screen.findByTestId('rename-deck-input'), 'Inglés');
    await pulsar('rename-deck-save');

    const library = guardado(repositorio);
    expect(library.decks[0]?.id).toBe('mazo-1');
    expect(library.cards.map((card) => card.deckId)).toEqual(['mazo-1']);
  });

  it('cancelar no cambia nada de lo guardado', async () => {
    const repositorio = createMemoryRepository();
    montarApp(repositorio);
    await screen.findByTestId('create-deck-button');
    await crearMazo('Inglés');
    await abrirMazo('mazo-1');
    const antes = repositorio.peek();

    await pulsar('rename-deck-button');
    fireEvent.changeText(await screen.findByTestId('rename-deck-input'), 'Otro nombre');
    await pulsar('rename-deck-cancel');

    expect(repositorio.peek()).toBe(antes);
    expect(screen.queryByTestId('rename-deck-input')).toBeNull();
  });

  it('muestra un error visible si el nombre queda vacío, y no guarda', async () => {
    const repositorio = createMemoryRepository();
    montarApp(repositorio);
    await screen.findByTestId('create-deck-button');
    await crearMazo('Inglés');
    await abrirMazo('mazo-1');
    const antes = repositorio.peek();

    await pulsar('rename-deck-button');
    fireEvent.changeText(await screen.findByTestId('rename-deck-input'), '   ');
    await pulsar('rename-deck-save');

    expect(await screen.findByText('Escribe un nombre para el mazo.')).toBeTruthy();
    expect(repositorio.peek()).toBe(antes);
  });

  it('muestra un error visible si el nombre ya es de otro mazo, y no guarda', async () => {
    const repositorio = createMemoryRepository();
    montarApp(repositorio);
    await screen.findByTestId('create-deck-button');
    await crearMazo('Inglés');
    await crearMazo('Alemán');
    await abrirMazo('mazo-2');
    const antes = repositorio.peek();

    await pulsar('rename-deck-button');
    fireEvent.changeText(await screen.findByTestId('rename-deck-input'), '  inglés  ');
    await pulsar('rename-deck-save');

    expect(await screen.findByText('Ya tienes un mazo con ese nombre. Elige otro.')).toBeTruthy();
    expect(repositorio.peek()).toBe(antes);
  });

  it('deja conservar el propio nombre con otras mayúsculas', async () => {
    const repositorio = createMemoryRepository();
    montarApp(repositorio);
    await screen.findByTestId('create-deck-button');
    await crearMazo('Inglés');
    await abrirMazo('mazo-1');

    await pulsar('rename-deck-button');
    fireEvent.changeText(await screen.findByTestId('rename-deck-input'), 'INGLÉS');
    await pulsar('rename-deck-save');

    expect(guardado(repositorio).decks[0]?.name).toBe('INGLÉS');
  });
});

describe('Eliminar un mazo', () => {
  it('avisa de que también se borran las cartas antes de hacer nada', async () => {
    await escenarioAB();
    await pulsar('delete-deck-button');

    expect(await screen.findByTestId('delete-confirm')).toBeTruthy();
    expect(screen.getByText(/también/)).toBeTruthy();
  });

  it('cancelar la confirmación no toca los datos', async () => {
    const repositorio = await escenarioAB();
    const antes = repositorio.peek();

    await pulsar('delete-deck-button');
    await screen.findByTestId('delete-confirm');
    await pulsar('delete-confirm-cancel');

    expect(repositorio.peek()).toBe(antes);
  });

  it('borra el mazo y sus cartas, y deja intacto el otro mazo', async () => {
    const repositorio = await escenarioAB();

    // Se vuelve al Mazo A y se borra desde su detalle.
    await pulsar('back-to-decks');
    await screen.findByTestId('decks-list');
    await abrirMazo('mazo-1');
    await pulsar('delete-deck-button');
    await screen.findByTestId('delete-confirm');
    await pulsar('delete-confirm-confirm');

    const library = guardado(repositorio);
    expect(library.decks.map((deck) => deck.name)).toEqual(['Mazo B']);
    expect(library.cards.map((card) => card.front)).toEqual(['Carta 3']);
  });

  it('el borrado en cascada sobrevive a recrear el proveedor', async () => {
    const repositorio = await escenarioAB();
    await pulsar('back-to-decks');
    await screen.findByTestId('decks-list');
    await abrirMazo('mazo-1');
    await pulsar('delete-deck-button');
    await screen.findByTestId('delete-confirm');
    await pulsar('delete-confirm-confirm');

    const { unmount } = montarApp(repositorio, '/mazo/mazo-4');
    unmount();
    montarApp(repositorio, '/mazo/mazo-4');

    // Mazo B y su carta siguen ahí después de reconstruir el estado desde el medio.
    expect(await screen.findByText('Mazo B')).toBeTruthy();
    expect(screen.getByText('Carta 3')).toBeTruthy();
  });
});

describe('Editar una carta', () => {
  it('cambia el reverso y lo guarda', async () => {
    const repositorio = createMemoryRepository();
    const { unmount } = montarApp(repositorio);
    await screen.findByTestId('create-deck-button');
    await crearMazo('Geografía');
    await abrirMazo('mazo-1');
    await anadirCarta('Capital de Francia', 'Londres');

    await pulsar('edit-card-carta-2');
    fireEvent.changeText(await screen.findByTestId('edit-card-back-carta-2'), 'París');
    await pulsar('save-card-carta-2');

    unmount();
    montarApp(repositorio, '/mazo/mazo-1');

    expect(await screen.findByText('París')).toBeTruthy();
    expect(screen.queryByText('Londres')).toBeNull();
  });

  it('mantiene el id y el mazo de la carta', async () => {
    const repositorio = createMemoryRepository();
    montarApp(repositorio);
    await screen.findByTestId('create-deck-button');
    await crearMazo('Geografía');
    await abrirMazo('mazo-1');
    await anadirCarta('Capital de Francia', 'Londres');

    await pulsar('edit-card-carta-2');
    fireEvent.changeText(await screen.findByTestId('edit-card-front-carta-2'), 'Capital francesa');
    fireEvent.changeText(screen.getByTestId('edit-card-back-carta-2'), 'París');
    await pulsar('save-card-carta-2');

    expect(guardado(repositorio).cards).toEqual([
      { id: 'carta-2', deckId: 'mazo-1', front: 'Capital francesa', back: 'París' },
    ]);
  });

  it('cancelar la edición no cambia la carta', async () => {
    const repositorio = createMemoryRepository();
    montarApp(repositorio);
    await screen.findByTestId('create-deck-button');
    await crearMazo('Geografía');
    await abrirMazo('mazo-1');
    await anadirCarta('Capital de Francia', 'Londres');
    const antes = repositorio.peek();

    await pulsar('edit-card-carta-2');
    fireEvent.changeText(await screen.findByTestId('edit-card-back-carta-2'), 'París');
    await pulsar('cancel-card-carta-2');

    expect(repositorio.peek()).toBe(antes);
    expect(await screen.findByText('Londres')).toBeTruthy();
  });

  it('rechaza dejar una cara vacía y lo dice', async () => {
    const repositorio = createMemoryRepository();
    montarApp(repositorio);
    await screen.findByTestId('create-deck-button');
    await crearMazo('Geografía');
    await abrirMazo('mazo-1');
    await anadirCarta('Capital de Francia', 'Londres');
    const antes = repositorio.peek();

    await pulsar('edit-card-carta-2');
    fireEvent.changeText(await screen.findByTestId('edit-card-back-carta-2'), '   ');
    await pulsar('save-card-carta-2');

    expect(await screen.findByTestId('edit-card-error-carta-2')).toBeTruthy();
    expect(repositorio.peek()).toBe(antes);
  });
});

describe('Eliminar una carta', () => {
  it('pide confirmación y cancelar no borra nada', async () => {
    const repositorio = createMemoryRepository();
    montarApp(repositorio);
    await screen.findByTestId('create-deck-button');
    await crearMazo('Inglés');
    await abrirMazo('mazo-1');
    await anadirCarta('one', 'uno');
    await anadirCarta('two', 'dos');
    const antes = repositorio.peek();

    await pulsar('delete-card-carta-2');
    await screen.findByTestId('delete-confirm');
    await pulsar('delete-confirm-cancel');

    expect(repositorio.peek()).toBe(antes);
  });

  it('borra solo esa carta y deja el mazo y la otra carta', async () => {
    const repositorio = createMemoryRepository();
    const { unmount } = montarApp(repositorio);
    await screen.findByTestId('create-deck-button');
    await crearMazo('Inglés');
    await abrirMazo('mazo-1');
    await anadirCarta('one', 'uno');
    await anadirCarta('two', 'dos');

    await pulsar('delete-card-carta-2');
    await screen.findByTestId('delete-confirm');
    await pulsar('delete-confirm-confirm');

    unmount();
    montarApp(repositorio, '/mazo/mazo-1');
    await screen.findByTestId('cards-list');

    const library = guardado(repositorio);
    expect(library.decks).toHaveLength(1);
    expect(library.cards.map((card) => card.front)).toEqual(['two']);
    expect(screen.queryByText('one')).toBeNull();
  });
});
