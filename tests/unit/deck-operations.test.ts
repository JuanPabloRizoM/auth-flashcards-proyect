import {
  addCards,
  cardsOfDeck,
  createDeck,
  deleteCard,
  deleteDeck,
  editCard,
  emptyLibrary,
  findCard,
  findDeck,
  renameDeck,
} from '../../src/features/decks/library';
import { newScheduling } from '../../src/features/scheduler/types';
import type { Library } from '../../src/types/domain';

/** Relojes fijos: el modelo guarda la fecha de modificación y se afirma sobre valores concretos. */
const T0 = '2026-08-22T09:00:00.000Z';
const T1 = '2026-08-22T10:00:00.000Z';
const T2 = '2026-08-22T11:00:00.000Z';

/**
 * El escenario del enunciado:
 *
 * ```text
 * Mazo A ── Carta 1, Carta 2
 * Mazo B ── Carta 3
 * ```
 */
const biblioteca: Library = {
  decks: [
    { id: 'mazo-a', name: 'Mazo A', updatedAt: T0 },
    { id: 'mazo-b', name: 'Mazo B', updatedAt: T0 },
  ],
  cards: [
    { id: 'carta-1', deckId: 'mazo-a', front: 'Carta 1', back: 'Uno', scheduling: { ...newScheduling } },
    { id: 'carta-2', deckId: 'mazo-a', front: 'Carta 2', back: 'Dos', scheduling: { ...newScheduling } },
    { id: 'carta-3', deckId: 'mazo-b', front: 'Carta 3', back: 'Tres', scheduling: { ...newScheduling } },
  ],
  scheduler: null,
};

function libraryDe(result: ReturnType<typeof renameDeck>): Library {
  if (!result.ok) {
    throw new Error(`la operación debería haber funcionado, devolvió ${result.error}`);
  }
  return result.library;
}

describe('renameDeck', () => {
  it('cambia el nombre y recorta los espacios de los extremos', () => {
    const library = libraryDe(renameDeck(biblioteca, 'mazo-a', '  Inglés  ', T1));

    expect(findDeck(library, 'mazo-a')?.name).toBe('Inglés');
  });

  it('conserva el mismo id, así que las cartas siguen siendo suyas', () => {
    const library = libraryDe(renameDeck(biblioteca, 'mazo-a', 'Inglés', T1));

    expect(findDeck(library, 'mazo-a')?.id).toBe('mazo-a');
    expect(cardsOfDeck(library, 'mazo-a').map((card) => card.id)).toEqual([
      'carta-1',
      'carta-2',
    ]);
  });

  it('marca el mazo como modificado y no toca los demás', () => {
    const library = libraryDe(renameDeck(biblioteca, 'mazo-a', 'Inglés', T1));

    expect(findDeck(library, 'mazo-a')?.updatedAt).toBe(T1);
    expect(findDeck(library, 'mazo-b')?.updatedAt).toBe(T0);
  });

  it('rechaza un nombre vacío', () => {
    expect(renameDeck(biblioteca, 'mazo-a', '', T1)).toEqual({
      ok: false,
      error: 'nombre-requerido',
    });
  });

  it('rechaza un nombre que solo tiene espacios', () => {
    expect(renameDeck(biblioteca, 'mazo-a', '   ', T1)).toEqual({
      ok: false,
      error: 'nombre-requerido',
    });
  });

  it('rechaza el nombre de otro mazo, sin distinguir mayúsculas ni espacios exteriores', () => {
    expect(renameDeck(biblioteca, 'mazo-a', '  mAzO b  ', T1)).toEqual({
      ok: false,
      error: 'nombre-duplicado',
    });
  });

  it('permite dejar el mazo con su propio nombre', () => {
    expect(renameDeck(biblioteca, 'mazo-a', 'Mazo A', T1).ok).toBe(true);
  });

  it('permite cambiar solo las mayúsculas del propio nombre', () => {
    const library = libraryDe(renameDeck(biblioteca, 'mazo-a', 'MAZO A', T1));

    expect(findDeck(library, 'mazo-a')?.name).toBe('MAZO A');
  });

  it('rechaza renombrar un mazo que no existe', () => {
    expect(renameDeck(biblioteca, 'mazo-z', 'Otro', T1)).toEqual({
      ok: false,
      error: 'mazo-inexistente',
    });
  });

  it('no modifica la biblioteca recibida', () => {
    renameDeck(biblioteca, 'mazo-a', 'Inglés', T1);

    expect(biblioteca.decks[0]?.name).toBe('Mazo A');
  });
});

describe('deleteDeck', () => {
  it('elimina el mazo y, en cascada, todas sus cartas', () => {
    const library = libraryDe(deleteDeck(biblioteca, 'mazo-a'));

    expect(findDeck(library, 'mazo-a')).toBeUndefined();
    expect(library.cards.map((card) => card.id)).toEqual(['carta-3']);
  });

  it('deja intactos los demás mazos y sus cartas', () => {
    const library = libraryDe(deleteDeck(biblioteca, 'mazo-a'));

    expect(findDeck(library, 'mazo-b')?.name).toBe('Mazo B');
    expect(cardsOfDeck(library, 'mazo-b').map((card) => card.front)).toEqual(['Carta 3']);
  });

  it('no deja ninguna carta huérfana apuntando al mazo borrado', () => {
    const library = libraryDe(deleteDeck(biblioteca, 'mazo-a'));

    expect(library.cards.some((card) => card.deckId === 'mazo-a')).toBe(false);
  });

  it('libera el nombre para poder reutilizarlo', () => {
    const library = libraryDe(deleteDeck(biblioteca, 'mazo-a'));

    expect(createDeck(library, 'Mazo A', 'mazo-c', T1).ok).toBe(true);
  });

  it('rechaza borrar un mazo que no existe', () => {
    expect(deleteDeck(biblioteca, 'mazo-z')).toEqual({ ok: false, error: 'mazo-inexistente' });
  });

  it('no modifica la biblioteca recibida', () => {
    deleteDeck(biblioteca, 'mazo-a');

    expect(biblioteca.decks).toHaveLength(2);
    expect(biblioteca.cards).toHaveLength(3);
  });
});

describe('editCard', () => {
  it('cambia solo el reverso cuando el frente se deja igual', () => {
    const partida = libraryDe(
      editCard(biblioteca, 'carta-1', 'Capital de Francia', 'Londres', T1),
    );
    const library = libraryDe(editCard(partida, 'carta-1', 'Capital de Francia', 'París', T2));

    expect(findCard(library, 'carta-1')).toEqual({
      id: 'carta-1',
      deckId: 'mazo-a',
      scheduling: { ...newScheduling },
      front: 'Capital de Francia',
      back: 'París',
    });
  });

  it('cambia las dos caras a la vez', () => {
    const library = libraryDe(editCard(biblioteca, 'carta-1', 'Nuevo frente', 'Nuevo reverso', T1));

    expect(findCard(library, 'carta-1')).toMatchObject({
      front: 'Nuevo frente',
      back: 'Nuevo reverso',
    });
  });

  it('mantiene el id y el mazo: es la misma carta con otro contenido', () => {
    const library = libraryDe(editCard(biblioteca, 'carta-1', 'a', 'b', T1));

    expect(findCard(library, 'carta-1')?.deckId).toBe('mazo-a');
    expect(library.cards).toHaveLength(3);
  });

  it('recorta los espacios de los extremos', () => {
    const library = libraryDe(editCard(biblioteca, 'carta-1', '  a  ', '  b  ', T1));

    expect(findCard(library, 'carta-1')).toMatchObject({ front: 'a', back: 'b' });
  });

  it('rechaza un frente vacío', () => {
    expect(editCard(biblioteca, 'carta-1', '   ', 'algo', T1)).toEqual({
      ok: false,
      error: 'frente-requerido',
    });
  });

  it('rechaza un reverso vacío', () => {
    expect(editCard(biblioteca, 'carta-1', 'algo', '', T1)).toEqual({
      ok: false,
      error: 'reverso-requerido',
    });
  });

  it('rechaza editar una carta que no existe', () => {
    expect(editCard(biblioteca, 'carta-z', 'a', 'b', T1)).toEqual({
      ok: false,
      error: 'carta-inexistente',
    });
  });

  it('marca como modificado el mazo de la carta, y solo ese', () => {
    const library = libraryDe(editCard(biblioteca, 'carta-1', 'a', 'b', T1));

    expect(findDeck(library, 'mazo-a')?.updatedAt).toBe(T1);
    expect(findDeck(library, 'mazo-b')?.updatedAt).toBe(T0);
  });

  it('no deja tocadas las demás cartas', () => {
    const library = libraryDe(editCard(biblioteca, 'carta-1', 'a', 'b', T1));

    expect(findCard(library, 'carta-2')).toEqual(biblioteca.cards[1]);
    expect(findCard(library, 'carta-3')).toEqual(biblioteca.cards[2]);
  });
});

describe('deleteCard', () => {
  it('elimina solo esa carta', () => {
    const library = libraryDe(deleteCard(biblioteca, 'carta-1', T1));

    expect(library.cards.map((card) => card.id)).toEqual(['carta-2', 'carta-3']);
  });

  it('no elimina el mazo aunque se quede sin cartas', () => {
    const conUna = libraryDe(deleteCard(biblioteca, 'carta-3', T1));

    expect(findDeck(conUna, 'mazo-b')).toBeDefined();
    expect(cardsOfDeck(conUna, 'mazo-b')).toEqual([]);
  });

  it('rechaza borrar una carta que no existe', () => {
    expect(deleteCard(biblioteca, 'carta-z', T1)).toEqual({
      ok: false,
      error: 'carta-inexistente',
    });
  });

  it('marca como modificado el mazo al que pertenecía', () => {
    const library = libraryDe(deleteCard(biblioteca, 'carta-1', T1));

    expect(findDeck(library, 'mazo-a')?.updatedAt).toBe(T1);
  });
});

describe('addCards: el lote de la importación', () => {
  const filas = [
    { front: 'Hello', back: 'Hola' },
    { front: 'House', back: 'Casa' },
  ];

  it('añade todas las cartas al mazo indicado', () => {
    const library = libraryDe(addCards(biblioteca, 'mazo-b', filas, ['c-10', 'c-11'], T1));

    expect(cardsOfDeck(library, 'mazo-b').map((card) => card.front)).toEqual([
      'Carta 3',
      'Hello',
      'House',
    ]);
  });

  it('no toca las cartas de los demás mazos', () => {
    const library = libraryDe(addCards(biblioteca, 'mazo-b', filas, ['c-10', 'c-11'], T1));

    expect(cardsOfDeck(library, 'mazo-a')).toEqual(biblioteca.cards.slice(0, 2));
  });

  it('no añade nada si alguna fila del lote no vale', () => {
    const conHueco = [...filas, { front: '  ', back: 'Casa' }];

    expect(addCards(biblioteca, 'mazo-b', conHueco, ['a', 'b', 'c'], T1)).toEqual({
      ok: false,
      error: 'frente-requerido',
    });
  });

  it('rechaza un lote vacío', () => {
    expect(addCards(biblioteca, 'mazo-b', [], [], T1)).toEqual({
      ok: false,
      error: 'sin-cartas-validas',
    });
  });

  it('rechaza importar a un mazo que no existe', () => {
    expect(addCards(biblioteca, 'mazo-z', filas, ['a', 'b'], T1)).toEqual({
      ok: false,
      error: 'mazo-inexistente',
    });
  });

  it('marca el mazo como modificado', () => {
    const library = libraryDe(addCards(biblioteca, 'mazo-b', filas, ['c-10', 'c-11'], T1));

    expect(findDeck(library, 'mazo-b')?.updatedAt).toBe(T1);
  });

  it('no modifica la biblioteca recibida', () => {
    addCards(biblioteca, 'mazo-b', filas, ['c-10', 'c-11'], T1);

    expect(biblioteca.cards).toHaveLength(3);
  });

  it('conserva el mazo vacío como estaba si el lote es inválido', () => {
    const vacio = libraryDe(createDeck(emptyLibrary, 'Nuevo', 'mazo-n', T0));

    expect(addCards(vacio, 'mazo-n', [{ front: 'a', back: '' }], ['x'], T1).ok).toBe(false);
    expect(vacio.cards).toEqual([]);
  });
});
