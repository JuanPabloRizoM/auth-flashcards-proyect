import {
  parseStoredLibrary,
  serializeLibrary,
  STORAGE_KEY,
  STORAGE_VERSION,
} from '../../src/lib/storage';
import { createAsyncStorageRepository } from '../../src/lib/storage/asyncStorageRepository';
import {
  createFailingRepository,
  createMemoryRepository,
} from '../../src/lib/storage/memoryRepository';
import type { LibraryRepository } from '../../src/lib/storage/types';
import type { Library } from '../../src/types/domain';

const biblioteca: Library = {
  decks: [{ id: 'mazo-1', name: 'Inglés' }],
  cards: [{ id: 'carta-1', deckId: 'mazo-1', front: 'to overlook', back: 'pasar por alto' }],
};

describe('serializeLibrary', () => {
  it('escribe la versión, los mazos y las cartas', () => {
    const documento = JSON.parse(serializeLibrary(biblioteca));

    expect(documento).toEqual({
      version: STORAGE_VERSION,
      decks: biblioteca.decks,
      cards: biblioteca.cards,
    });
  });

  it('es reversible: serializar y parsear devuelve lo mismo', () => {
    const resultado = parseStoredLibrary(serializeLibrary(biblioteca));

    expect(resultado).toEqual({ status: 'ok', library: biblioteca });
  });

  it('no pierde las cartas al recorrer el ciclo completo dos veces', () => {
    const unaVez = parseStoredLibrary(serializeLibrary(biblioteca));
    if (unaVez.status !== 'ok') throw new Error('debería ser ok');
    const dosVeces = parseStoredLibrary(serializeLibrary(unaVez.library));

    expect(dosVeces).toEqual({ status: 'ok', library: biblioteca });
  });
});

describe('parseStoredLibrary', () => {
  it('trata la ausencia de datos como almacenamiento vacío, no como error', () => {
    expect(parseStoredLibrary(null)).toEqual({ status: 'empty' });
    expect(parseStoredLibrary('')).toEqual({ status: 'empty' });
  });

  it('rechaza JSON inválido de forma controlada', () => {
    expect(parseStoredLibrary('{no es json')).toEqual({
      status: 'error',
      reason: 'contenido-invalido',
    });
  });

  it('rechaza un documento que no es un objeto', () => {
    expect(parseStoredLibrary('[]').status).toBe('error');
    expect(parseStoredLibrary('"texto"').status).toBe('error');
    // Ojo: la cadena "null" es contenido guardado inválido, no ausencia de datos.
    // La ausencia es el valor `null` de JavaScript, cubierto en el caso de arriba.
    expect(parseStoredLibrary('null').status).toBe('error');
  });

  it('rechaza una versión desconocida', () => {
    const futuro = JSON.stringify({ version: 99, decks: [], cards: [] });

    expect(parseStoredLibrary(futuro)).toEqual({
      status: 'error',
      reason: 'contenido-invalido',
    });
  });

  it('rechaza mazos con la forma equivocada', () => {
    const malo = JSON.stringify({
      version: STORAGE_VERSION,
      decks: [{ id: 'mazo-1' }],
      cards: [],
    });

    expect(parseStoredLibrary(malo).status).toBe('error');
  });

  it('rechaza cartas con la forma equivocada', () => {
    const malo = JSON.stringify({
      version: STORAGE_VERSION,
      decks: [],
      cards: [{ id: 'carta-1', deckId: 'mazo-1', front: 'solo frente' }],
    });

    expect(parseStoredLibrary(malo).status).toBe('error');
  });

  it('acepta una biblioteca vacía bien formada', () => {
    const vacia = JSON.stringify({ version: STORAGE_VERSION, decks: [], cards: [] });

    expect(parseStoredLibrary(vacia)).toEqual({
      status: 'ok',
      library: { decks: [], cards: [] },
    });
  });
});

describe('repositorio en memoria: cumple el mismo contrato', () => {
  it('lo guardado se recupera igual', async () => {
    const repositorio = createMemoryRepository();

    await repositorio.save(biblioteca);

    expect(await repositorio.load()).toEqual({ status: 'ok', library: biblioteca });
  });

  it('parte de almacenamiento vacío', async () => {
    expect(await createMemoryRepository().load()).toEqual({ status: 'empty' });
  });

  it('un contenido inválido preexistente no se borra al leerlo', async () => {
    const repositorio = createMemoryRepository('{roto');

    const resultado = await repositorio.load();

    expect(resultado).toEqual({ status: 'error', reason: 'contenido-invalido' });
    // Lo que había sigue ahí: leer no destruye.
    expect(repositorio.peek()).toBe('{roto');
  });
});

describe('repositorio que falla', () => {
  it('informa del error al leer en lugar de lanzar', async () => {
    expect(await createFailingRepository().load()).toEqual({
      status: 'error',
      reason: 'ilegible',
    });
  });

  it('rechaza la promesa al guardar', async () => {
    await expect(createFailingRepository().save(biblioteca)).rejects.toThrow();
  });
});

/**
 * Suite de contrato: se ejecuta contra TODAS las implementaciones de `LibraryRepository`.
 *
 * Sin esto, romper la implementación persistente dejaba unit e integración en verde y solo lo
 * detectaba el E2E, que es demasiado tarde y demasiado lejos de la causa.
 */
describe.each([
  ['memoria', () => createMemoryRepository()],
  ['AsyncStorage', () => createAsyncStorageRepository()],
])('contrato de LibraryRepository: %s', (_nombre, crear) => {
  let repositorio: LibraryRepository;

  beforeEach(() => {
    repositorio = crear();
  });

  it('parte de un almacenamiento vacío', async () => {
    expect(await repositorio.load()).toEqual({ status: 'empty' });
  });

  it('lo guardado se recupera exactamente igual', async () => {
    await repositorio.save(biblioteca);

    expect(await repositorio.load()).toEqual({ status: 'ok', library: biblioteca });
  });

  it('guardar dos veces conserva lo último, sin mezclar', async () => {
    await repositorio.save(biblioteca);

    const ampliada = {
      decks: biblioteca.decks,
      cards: [
        ...biblioteca.cards,
        { id: 'carta-2', deckId: 'mazo-1', front: 'to withstand', back: 'resistir' },
      ],
    };
    await repositorio.save(ampliada);

    expect(await repositorio.load()).toEqual({ status: 'ok', library: ampliada });
  });

  it('conserva la pertenencia de cada carta a su mazo', async () => {
    const dosMazos = {
      decks: [
        { id: 'mazo-1', name: 'Inglés' },
        { id: 'mazo-2', name: 'Alemán' },
      ],
      cards: [
        { id: 'carta-1', deckId: 'mazo-1', front: 'to overlook', back: 'pasar por alto' },
        { id: 'carta-2', deckId: 'mazo-2', front: 'übersehen', back: 'pasar por alto' },
      ],
    };

    await repositorio.save(dosMazos);
    const recuperado = await repositorio.load();

    expect(recuperado.status).toBe('ok');
    if (recuperado.status === 'ok') {
      expect(recuperado.library.cards.map((card) => card.deckId)).toEqual(['mazo-1', 'mazo-2']);
    }
  });
});

describe('asyncStorageRepository: fallos del medio', () => {
  it('informa de un medio ilegible en lugar de lanzar', async () => {
    const medioRoto = {
      getItem: async () => {
        throw new Error('el medio no responde');
      },
      setItem: async () => undefined,
    };

    const repositorio = createAsyncStorageRepository(medioRoto);

    await expect(repositorio.load()).resolves.toEqual({
      status: 'error',
      reason: 'ilegible',
    });
  });

  it('propaga el fallo al guardar, para que el proveedor pueda avisar', async () => {
    const medioRoto = {
      getItem: async () => null,
      setItem: async () => {
        throw new Error('sin espacio');
      },
    };

    await expect(createAsyncStorageRepository(medioRoto).save(biblioteca)).rejects.toThrow();
  });

  it('escribe bajo la clave versionada esperada', async () => {
    const escrituras: { clave: string; valor: string }[] = [];
    const medio = {
      getItem: async () => null,
      setItem: async (clave: string, valor: string) => {
        escrituras.push({ clave, valor });
      },
    };

    await createAsyncStorageRepository(medio).save(biblioteca);

    expect(escrituras).toHaveLength(1);
    expect(escrituras[0]?.clave).toBe(STORAGE_KEY);
    expect(parseStoredLibrary(escrituras[0]?.valor ?? null)).toEqual({
      status: 'ok',
      library: biblioteca,
    });
  });
});
