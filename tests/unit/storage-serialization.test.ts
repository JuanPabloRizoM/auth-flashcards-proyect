import { newScheduling } from '../../src/features/scheduler/types';
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
  decks: [{ id: 'mazo-1', name: 'Inglés', updatedAt: '2026-08-20T10:00:00.000Z' }],
  cards: [
    {
      id: 'carta-1',
      deckId: 'mazo-1',
      front: 'to overlook',
      back: 'pasar por alto',
      scheduling: { ...newScheduling },
    },
  ],
  scheduler: null,
};

describe('serializeLibrary', () => {
  it('escribe la versión, los mazos y las cartas', () => {
    const documento = JSON.parse(serializeLibrary(biblioteca));

    expect(documento).toEqual({
      version: STORAGE_VERSION,
      decks: biblioteca.decks,
      cards: biblioteca.cards,
      scheduler: null,
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
      library: { decks: [], cards: [], scheduler: null },
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

    const ampliada: Library = {
      ...biblioteca,
      cards: [
        ...biblioteca.cards,
        { id: 'carta-2', deckId: 'mazo-1', front: 'to withstand', back: 'resistir', scheduling: { ...newScheduling } },
      ],
    };
    await repositorio.save(ampliada);

    expect(await repositorio.load()).toEqual({ status: 'ok', library: ampliada });
  });

  it('conserva la pertenencia de cada carta a su mazo', async () => {
    const dosMazos: Library = {
      scheduler: null,
      decks: [
        { id: 'mazo-1', name: 'Inglés', updatedAt: '2026-08-20T10:00:00.000Z' },
        { id: 'mazo-2', name: 'Alemán', updatedAt: '2026-08-20T11:00:00.000Z' },
      ],
      cards: [
        { id: 'carta-1', deckId: 'mazo-1', front: 'to overlook', back: 'pasar por alto', scheduling: { ...newScheduling } },
        { id: 'carta-2', deckId: 'mazo-2', front: 'übersehen', back: 'pasar por alto', scheduling: { ...newScheduling } },
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

/**
 * TASK-005 añade `updatedAt` a los mazos y sube el documento a la versión 2. Lo que hay
 * guardado en los dispositivos es de la versión 1, así que la lectura tiene que migrarlo:
 * marcarlo como inválido habría hecho desaparecer bibliotecas enteras.
 */
describe('migración de la versión 1 a la versión 2', () => {
  const MIGRADO_EN = '2026-08-22T12:00:00.000Z';

  const documentoV1 = JSON.stringify({
    version: 1,
    decks: [
      { id: 'mazo-1', name: 'Inglés' },
      { id: 'mazo-2', name: 'Alemán' },
    ],
    cards: [{ id: 'carta-1', deckId: 'mazo-1', front: 'to overlook', back: 'pasar por alto', scheduling: { ...newScheduling } }],
  });

  it('lee un documento de la versión 1 sin darlo por inválido', () => {
    expect(parseStoredLibrary(documentoV1, MIGRADO_EN).status).toBe('ok');
  });

  it('conserva todos los mazos y todas las cartas', () => {
    const resultado = parseStoredLibrary(documentoV1, MIGRADO_EN);
    if (resultado.status !== 'ok') throw new Error('debería ser ok');

    expect(resultado.library.decks.map((deck) => deck.name)).toEqual(['Inglés', 'Alemán']);
    expect(resultado.library.cards).toHaveLength(1);
    expect(resultado.library.cards[0]?.deckId).toBe('mazo-1');
  });

  it('rellena la fecha de modificación que la versión 1 no guardaba', () => {
    const resultado = parseStoredLibrary(documentoV1, MIGRADO_EN);
    if (resultado.status !== 'ok') throw new Error('debería ser ok');

    expect(resultado.library.decks.map((deck) => deck.updatedAt)).toEqual([
      MIGRADO_EN,
      MIGRADO_EN,
    ]);
  });

  it('al volver a guardar, lo escrito ya es de la versión actual', () => {
    const resultado = parseStoredLibrary(documentoV1, MIGRADO_EN);
    if (resultado.status !== 'ok') throw new Error('debería ser ok');

    const reescrito = JSON.parse(serializeLibrary(resultado.library));

    expect(reescrito.version).toBe(STORAGE_VERSION);
    expect(STORAGE_VERSION).toBe(3);
  });

  it('migrar dos veces da el mismo resultado', () => {
    const unaVez = parseStoredLibrary(documentoV1, MIGRADO_EN);
    if (unaVez.status !== 'ok') throw new Error('debería ser ok');
    const dosVeces = parseStoredLibrary(serializeLibrary(unaVez.library), 'otra-fecha');

    expect(dosVeces).toEqual(unaVez);
  });

  it('sigue rechazando un documento de una versión que no sabe leer', () => {
    const futuro = JSON.stringify({ version: 99, decks: [], cards: [] });

    expect(parseStoredLibrary(futuro)).toEqual({
      status: 'error',
      reason: 'contenido-invalido',
    });
  });

  it('rechaza un documento de la versión 2 al que le falta la fecha en un mazo', () => {
    const roto = JSON.stringify({
      version: 2,
      decks: [{ id: 'mazo-1', name: 'Inglés' }],
      cards: [],
    });

    expect(parseStoredLibrary(roto)).toEqual({
      status: 'error',
      reason: 'contenido-invalido',
    });
  });
});

describe('migración a la versión 3: scheduling de las cartas', () => {
  /** Documento tal y como lo escribía TASK-005: versión 2, cartas sin `scheduling`. */
  const documentoV2 = JSON.stringify({
    version: 2,
    decks: [
      { id: 'mazo-1', name: 'Inglés', updatedAt: '2026-08-20T10:00:00.000Z' },
      { id: 'mazo-2', name: 'Alemán', updatedAt: '2026-08-21T09:30:00.000Z' },
    ],
    cards: [
      { id: 'carta-1', deckId: 'mazo-1', front: 'to overlook', back: 'pasar por alto' },
      { id: 'carta-2', deckId: 'mazo-2', front: 'übersehen', back: 'pasar por alto' },
    ],
  });

  it('todas las cartas anteriores entran como Nueva', () => {
    const resultado = parseStoredLibrary(documentoV2);

    expect(resultado.status).toBe('ok');
    if (resultado.status !== 'ok') return;
    expect(resultado.library.cards).toHaveLength(2);
    for (const card of resultado.library.cards) {
      expect(card.scheduling).toEqual(newScheduling);
      expect(card.scheduling.state).toBe('nueva');
    }
  });

  it('no se inventa ninguna revisión ni ninguna calificación', () => {
    const resultado = parseStoredLibrary(documentoV2);

    if (resultado.status !== 'ok') throw new Error('debería migrar');
    for (const card of resultado.library.cards) {
      expect(card.scheduling.reps).toBe(0);
      expect(card.scheduling.lapses).toBe(0);
      expect(card.scheduling.lastReview).toBeNull();
      expect(card.scheduling.due).toBeNull();
      expect(card.scheduling.stability).toBe(0);
      expect(card.scheduling.difficulty).toBe(0);
    }
  });

  it('conserva intactos los mazos, sus nombres y sus fechas de modificación', () => {
    const resultado = parseStoredLibrary(documentoV2);

    if (resultado.status !== 'ok') throw new Error('debería migrar');
    expect(resultado.library.decks).toEqual([
      { id: 'mazo-1', name: 'Inglés', updatedAt: '2026-08-20T10:00:00.000Z' },
      { id: 'mazo-2', name: 'Alemán', updatedAt: '2026-08-21T09:30:00.000Z' },
    ]);
  });

  it('conserva id, mazo, frente y reverso de cada carta', () => {
    const resultado = parseStoredLibrary(documentoV2);

    if (resultado.status !== 'ok') throw new Error('debería migrar');
    expect(
      resultado.library.cards.map(({ id, deckId, front, back }) => ({ id, deckId, front, back })),
    ).toEqual([
      { id: 'carta-1', deckId: 'mazo-1', front: 'to overlook', back: 'pasar por alto' },
      { id: 'carta-2', deckId: 'mazo-2', front: 'übersehen', back: 'pasar por alto' },
    ]);
  });

  it('la biblioteca no se resetea: se migra, no se descarta', () => {
    const resultado = parseStoredLibrary(documentoV2);

    expect(resultado.status).not.toBe('error');
    if (resultado.status !== 'ok') return;
    expect(resultado.library.decks).toHaveLength(2);
    expect(resultado.library.cards).toHaveLength(2);
  });

  it('una biblioteca de la versión 1 también migra: fecha de mazo y scheduling a la vez', () => {
    const documentoV1 = JSON.stringify({
      version: 1,
      decks: [{ id: 'mazo-1', name: 'Inglés' }],
      cards: [{ id: 'carta-1', deckId: 'mazo-1', front: 'a', back: 'b' }],
    });

    const resultado = parseStoredLibrary(documentoV1, '2026-08-30T00:00:00.000Z');

    if (resultado.status !== 'ok') throw new Error('debería migrar');
    expect(resultado.library.decks[0]?.updatedAt).toBe('2026-08-30T00:00:00.000Z');
    expect(resultado.library.cards[0]?.scheduling).toEqual(newScheduling);
  });

  it('la versión anterior no traía metadata del scheduler, y no se inventa', () => {
    const resultado = parseStoredLibrary(documentoV2);

    if (resultado.status !== 'ok') throw new Error('debería migrar');
    expect(resultado.library.scheduler).toBeNull();
  });

  it('la clave de almacenamiento no cambia: la versión vive dentro del documento', () => {
    expect(STORAGE_KEY).toBe('flashcards:library:v1');
  });
});

describe('metadata del scheduler', () => {
  const metadata = {
    id: 'fsrs',
    version: 'ts-fsrs v5.4.1 using FSRS-6.0',
    parameters: {
      requestRetention: 0.9,
      maximumIntervalDays: 36500,
      learningSteps: ['1m', '10m'],
      relearningSteps: ['10m'],
      enableFuzz: false,
      enableShortTerm: true,
      weights: [0.212, 1.2931],
    },
  };

  it('se escribe con la biblioteca y se recupera al leerla', () => {
    const conMetadata: Library = { ...biblioteca, scheduler: metadata };
    const documento = JSON.parse(serializeLibrary(conMetadata));

    expect(documento.scheduler).toEqual(metadata);
    expect(parseStoredLibrary(serializeLibrary(conMetadata))).toEqual({
      status: 'ok',
      library: conMetadata,
    });
  });

  it('una metadata con forma inesperada invalida el documento en vez de leerse a medias', () => {
    const roto = JSON.stringify({
      version: STORAGE_VERSION,
      decks: [],
      cards: [],
      scheduler: { id: 'fsrs', version: 3, parameters: {} },
    });

    expect(parseStoredLibrary(roto)).toEqual({
      status: 'error',
      reason: 'contenido-invalido',
    });
  });
});

describe('scheduling persistido', () => {
  it('conserva estado, vencimiento, estabilidad y dificultad al ir y volver', () => {
    const programada: Library = {
      ...biblioteca,
      cards: [
        {
          id: 'carta-1',
          deckId: 'mazo-1',
          front: 'a',
          back: 'b',
          scheduling: {
            state: 'repaso',
            due: 1_800_000_000_000,
            lastReview: 1_799_000_000_000,
            stability: 12.34,
            difficulty: 5.67,
            elapsedDays: 4,
            scheduledDays: 12,
            learningSteps: 0,
            reps: 7,
            lapses: 2,
          },
        },
      ],
    };

    expect(parseStoredLibrary(serializeLibrary(programada))).toEqual({
      status: 'ok',
      library: programada,
    });
  });

  it('un scheduling con un estado desconocido invalida el documento', () => {
    const roto = JSON.stringify({
      version: STORAGE_VERSION,
      decks: [],
      cards: [
        {
          id: 'carta-1',
          deckId: 'mazo-1',
          front: 'a',
          back: 'b',
          scheduling: { ...newScheduling, state: 'inventado' },
        },
      ],
      scheduler: null,
    });

    expect(parseStoredLibrary(roto)).toEqual({ status: 'error', reason: 'contenido-invalido' });
  });
});
