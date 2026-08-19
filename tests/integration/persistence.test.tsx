import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';

import ComponentesScreen from '../../app/componentes';
import MisMazosScreen from '../../app/index';
import EstudiarScreen from '../../app/mazo/[id]/estudiar';
import DetalleMazoScreen from '../../app/mazo/[id]/index';
import { AppShell } from '../../src/components/layout';
import { LibraryProvider } from '../../src/lib/LibraryProvider';
import { parseStoredLibrary, type LibraryRepository } from '../../src/lib/storage';
import {
  createFailingRepository,
  createMemoryRepository,
  createWriteFailingRepository,
} from '../../src/lib/storage/memoryRepository';

import { Slot } from 'expo-router';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

/**
 * Monta la aplicación real con el repositorio que se le pase.
 *
 * Cada llamada crea un `LibraryProvider` nuevo: desmontar y volver a montar con el mismo
 * repositorio es lo que demuestra que los datos vienen del almacenamiento y no de un estado
 * de React que sobrevivió.
 */
function montarApp(repository: LibraryRepository, initialUrl = '/') {
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

describe('Hidratación', () => {
  it('muestra el estado de carga antes de decidir que no hay nada', async () => {
    montarApp(createMemoryRepository());

    // El estado vacío no puede aparecer antes de saber qué hay guardado.
    expect(screen.queryByTestId('decks-empty')).toBeNull();
    expect(screen.getByTestId('decks-loading')).toBeTruthy();

    expect(await screen.findByTestId('decks-empty')).toBeTruthy();
    expect(screen.queryByTestId('decks-loading')).toBeNull();
  });

  it('un almacenamiento vacío lleva al estado vacío, no a un error', async () => {
    montarApp(createMemoryRepository());

    expect(await screen.findByTestId('decks-empty')).toBeTruthy();
    expect(screen.queryByTestId('storage-error')).toBeNull();
  });
});

describe('Persistencia real: destruir y recrear el proveedor', () => {
  it('crear un mazo lo persiste y se recupera del almacenamiento', async () => {
    const repositorio = createMemoryRepository();

    montarApp(repositorio);
    await screen.findByTestId('create-deck-button');
    await crearMazo('Inglés');
    await screen.findByTestId('decks-list');

    // El medio contiene el mazo, no solo la memoria de React.
    const guardado = parseStoredLibrary(repositorio.peek());
    expect(guardado.status).toBe('ok');
    if (guardado.status === 'ok') {
      expect(guardado.library.decks).toEqual([{ id: 'mazo-1', name: 'Inglés' }]);
    }

    // Se destruye toda la aplicación y se vuelve a montar con el mismo repositorio.
    screen.unmount();
    montarApp(repositorio);

    expect(await screen.findByTestId('decks-list')).toBeTruthy();
    expect(screen.getByText('Inglés')).toBeTruthy();
    expect(screen.queryByTestId('decks-empty')).toBeNull();
  });

  it('crear una carta la persiste y sigue en su mazo tras reconstruir', async () => {
    const repositorio = createMemoryRepository();

    montarApp(repositorio);
    await screen.findByTestId('create-deck-button');
    await crearMazo('Inglés');
    await abrirMazo('mazo-1');
    await anadirCarta('to overlook', 'pasar por alto');
    await screen.findByTestId('cards-list');

    screen.unmount();
    montarApp(repositorio, '/mazo/mazo-1');

    expect(await screen.findByTestId('cards-list')).toBeTruthy();
    expect(screen.getByText('to overlook')).toBeTruthy();
    expect(screen.getByText('pasar por alto')).toBeTruthy();
  });

  it('dos cartas seguidas se conservan las dos', async () => {
    const repositorio = createMemoryRepository();

    montarApp(repositorio);
    await screen.findByTestId('create-deck-button');
    await crearMazo('Inglés');
    await abrirMazo('mazo-1');
    await anadirCarta('to overlook', 'pasar por alto');
    await anadirCarta('to withstand', 'resistir');

    screen.unmount();
    montarApp(repositorio, '/mazo/mazo-1');

    expect(await screen.findByText('to overlook')).toBeTruthy();
    expect(screen.getByText('to withstand')).toBeTruthy();
  });

  it('varios mazos conservan sus datos de forma independiente', async () => {
    const repositorio = createMemoryRepository();

    montarApp(repositorio);
    await screen.findByTestId('create-deck-button');
    await crearMazo('Inglés');
    await crearMazo('Alemán');

    screen.unmount();
    montarApp(repositorio);

    expect(await screen.findByText('Inglés')).toBeTruthy();
    expect(screen.getByText('Alemán')).toBeTruthy();
  });

  it('las cartas siguen aisladas por mazo después de restaurar', async () => {
    const repositorio = createMemoryRepository();

    montarApp(repositorio);
    await screen.findByTestId('create-deck-button');
    await crearMazo('Inglés');
    await crearMazo('Alemán');
    await abrirMazo('mazo-1');
    await anadirCarta('to overlook', 'pasar por alto');

    screen.unmount();

    // El mazo que no recibió cartas sigue vacío tras restaurar.
    montarApp(repositorio, '/mazo/mazo-2');
    expect(await screen.findByTestId('cards-empty')).toBeTruthy();
    expect(screen.queryByText('to overlook')).toBeNull();

    screen.unmount();

    // Y el que sí las recibió las conserva.
    montarApp(repositorio, '/mazo/mazo-1');
    expect(await screen.findByText('to overlook')).toBeTruthy();
  });

  it('rehidratar dos veces no duplica los datos', async () => {
    const repositorio = createMemoryRepository();

    montarApp(repositorio);
    await screen.findByTestId('create-deck-button');
    await crearMazo('Inglés');

    screen.unmount();
    montarApp(repositorio);
    await screen.findByTestId('decks-list');

    screen.unmount();
    montarApp(repositorio);
    await screen.findByTestId('decks-list');

    expect(screen.getAllByText('Inglés')).toHaveLength(1);
    expect(screen.getByText('1 mazo')).toBeTruthy();
  });

  it('los identificadores nuevos no chocan con los restaurados', async () => {
    const repositorio = createMemoryRepository();

    montarApp(repositorio);
    await screen.findByTestId('create-deck-button');
    await crearMazo('Inglés');

    screen.unmount();
    montarApp(repositorio);
    await screen.findByTestId('decks-list');
    await crearMazo('Alemán');

    const guardado = parseStoredLibrary(repositorio.peek());
    if (guardado.status !== 'ok') throw new Error('debería estar guardado');
    const ids = guardado.library.decks.map((deck) => deck.id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(guardado.library.decks).toHaveLength(2);
  });
});

// Regresión del hallazgo F1 del review #1: el contador de identificadores se reiniciaba con
// el RECUENTO de entidades, pero un intento rechazado consume un número sin guardar nada. Tras
// rehidratar, el contador volvía por debajo del mayor id emitido y lo reemitía: dos mazos
// distintos acababan compartiendo id y abrir uno mostraba el otro.
describe('Identificadores tras intentos fallidos y rehidratación', () => {
  it('no reemite identificadores aunque haya habido intentos rechazados', async () => {
    const repositorio = createMemoryRepository();

    montarApp(repositorio);
    await screen.findByTestId('create-deck-button');

    // Un intento rechazado entre dos válidos: consume número sin persistir nada.
    await crearMazo('');
    await crearMazo('Inglés');
    await crearMazo('   ');
    await crearMazo('Alemán');

    screen.unmount();
    montarApp(repositorio);
    await screen.findByTestId('decks-list');

    // Y más intentos fallidos después de restaurar.
    await crearMazo('Inglés');
    await crearMazo('Francés');

    const guardado = parseStoredLibrary(repositorio.peek());
    if (guardado.status !== 'ok') throw new Error('debería estar guardado');

    const ids = guardado.library.decks.map((deck) => deck.id);
    expect(guardado.library.decks.map((deck) => deck.name)).toEqual([
      'Inglés',
      'Alemán',
      'Francés',
    ]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('abrir un mazo tras rehidratar muestra ese mazo y no otro', async () => {
    const repositorio = createMemoryRepository();

    montarApp(repositorio);
    await screen.findByTestId('create-deck-button');
    await crearMazo('');
    await crearMazo('Alemán');

    screen.unmount();
    montarApp(repositorio);
    await screen.findByTestId('decks-list');
    await crearMazo('Francés');

    const guardado = parseStoredLibrary(repositorio.peek());
    if (guardado.status !== 'ok') throw new Error('debería estar guardado');
    const frances = guardado.library.decks.find((deck) => deck.name === 'Francés');
    if (!frances) throw new Error('Francés debería existir');

    await act(async () => {
      fireEvent.press(screen.getByTestId(`deck-${frances.id}`));
    });
    await screen.findByTestId('add-card-button');

    expect(screen.getAllByText('Francés').length).toBeGreaterThan(0);
    expect(screen.queryByText('Alemán')).toBeNull();
  });

  it('las cartas nuevas no reusan el id de una carta restaurada', async () => {
    const repositorio = createMemoryRepository();

    montarApp(repositorio);
    await screen.findByTestId('create-deck-button');
    await crearMazo('Inglés');
    await abrirMazo('mazo-1');
    await anadirCarta('', 'reverso sin frente');
    await anadirCarta('to overlook', 'pasar por alto');

    screen.unmount();
    montarApp(repositorio, '/mazo/mazo-1');
    await screen.findByTestId('cards-list');
    await anadirCarta('to withstand', 'resistir');

    const guardado = parseStoredLibrary(repositorio.peek());
    if (guardado.status !== 'ok') throw new Error('debería estar guardado');
    const ids = guardado.library.cards.map((card) => card.id);

    expect(guardado.library.cards).toHaveLength(2);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('Unicidad de mazo con persistencia', () => {
  it('un intento duplicado no modifica los datos persistidos', async () => {
    const repositorio = createMemoryRepository();

    montarApp(repositorio);
    await screen.findByTestId('create-deck-button');
    await crearMazo('Inglés');
    const antes = repositorio.peek();

    await crearMazo('INGLÉS');

    expect(screen.getByText('Ya tienes un mazo con ese nombre. Elige otro.')).toBeTruthy();
    expect(repositorio.peek()).toBe(antes);
  });

  it('el duplicado se rechaza también tras restaurar desde el almacenamiento', async () => {
    const repositorio = createMemoryRepository();

    montarApp(repositorio);
    await screen.findByTestId('create-deck-button');
    await crearMazo(' Inglés ');

    screen.unmount();
    montarApp(repositorio);
    await screen.findByTestId('decks-list');

    await crearMazo('inglés');

    expect(screen.getByText('Ya tienes un mazo con ese nombre. Elige otro.')).toBeTruthy();
    expect(screen.getAllByText('Inglés')).toHaveLength(1);
  });
});

describe('Errores de almacenamiento', () => {
  it('un fallo de lectura no rompe la aplicación y se comunica', async () => {
    montarApp(createFailingRepository());

    expect(await screen.findByTestId('storage-error')).toBeTruthy();
    // La aplicación sigue siendo usable: se puede crear un mazo.
    await crearMazo('Inglés');
    expect(await screen.findByTestId('decks-list')).toBeTruthy();
  });

  // El repositorio lee bien y falla solo al guardar: si además fallara al leer, las
  // escrituras quedarían suspendidas y `save` no llegaría a invocarse, dejando este test
  // inerte y sin cubrir la rama de error de escritura.
  it('un fallo de escritura no rompe la aplicación y se avisa', async () => {
    montarApp(createWriteFailingRepository());

    // Lee bien: arranca en estado vacío, sin aviso previo.
    expect(await screen.findByTestId('decks-empty')).toBeTruthy();
    expect(screen.queryByTestId('storage-error')).toBeNull();

    await crearMazo('Inglés');

    // El mazo está en pantalla aunque el guardado haya fallado...
    expect(await screen.findByText('Inglés')).toBeTruthy();
    // ...y la aplicación lo dice en lugar de fingir que se guardó.
    expect(await screen.findByTestId('storage-error')).toBeTruthy();
    expect(
      screen.getByText('No se han podido guardar los últimos cambios en este dispositivo.'),
    ).toBeTruthy();
  });

  it('tras un fallo de escritura se puede seguir usando la aplicación', async () => {
    montarApp(createWriteFailingRepository());
    await screen.findByTestId('decks-empty');

    await crearMazo('Inglés');
    await screen.findByTestId('storage-error');
    await abrirMazo('mazo-1');
    await anadirCarta('to overlook', 'pasar por alto');

    expect(await screen.findByText('to overlook')).toBeTruthy();
  });

  // El usuario prohibió expresamente borrar datos válidos ante errores. Si el medio no se
  // pudo leer, ahí abajo puede haber datos buenos: escribir encima los destruiría.
  it('si no se pudo leer, no se sobrescribe con la biblioteca vacía', async () => {
    const repositorio = createMemoryRepository('contenido que el medio no supo leer');
    const fallaAlLeer: LibraryRepository = {
      load: async () => ({ status: 'error', reason: 'ilegible' }),
      save: repositorio.save,
    };

    montarApp(fallaAlLeer);
    expect(await screen.findByTestId('storage-error')).toBeTruthy();

    await crearMazo('Inglés');
    await screen.findByTestId('decks-list');

    // Lo que había sigue intacto: la sesión no escribe encima.
    expect(repositorio.peek()).toBe('contenido que el medio no supo leer');
  });

  it('un contenido guardado inválido no se borra al arrancar', async () => {
    const repositorio = createMemoryRepository('{contenido roto');

    montarApp(repositorio);

    expect(await screen.findByTestId('storage-error')).toBeTruthy();
    expect(screen.getByTestId('decks-empty')).toBeTruthy();
    // Lo que había sigue intacto: arrancar no destruye.
    expect(repositorio.peek()).toBe('{contenido roto');
  });
});
