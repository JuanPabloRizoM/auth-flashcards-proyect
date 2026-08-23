import {
  buildDeckSummaries,
  deckSortOptions,
  filterDecks,
  formatUpdatedAt,
  sortDecks,
} from '../../src/features/decks/libraryView';
import type { Deck, Library } from '../../src/types/domain';

const mazos: Deck[] = [
  { id: 'mazo-1', name: 'Inglés', updatedAt: '2026-08-20T10:00:00.000Z' },
  { id: 'mazo-2', name: 'anatomía', updatedAt: '2026-08-22T10:00:00.000Z' },
  { id: 'mazo-3', name: 'Química', updatedAt: '2026-08-18T10:00:00.000Z' },
];

const nombres = (decks: readonly Deck[]) => decks.map((deck) => deck.name);

describe('filterDecks', () => {
  it('devuelve todos los mazos cuando no se busca nada', () => {
    expect(nombres(filterDecks(mazos, ''))).toEqual(['Inglés', 'anatomía', 'Química']);
  });

  it('ignora una búsqueda que solo tiene espacios', () => {
    expect(filterDecks(mazos, '   ')).toHaveLength(3);
  });

  it('busca sin distinguir mayúsculas de minúsculas', () => {
    expect(nombres(filterDecks(mazos, 'ANATOMÍA'))).toEqual(['anatomía']);
    expect(nombres(filterDecks(mazos, 'inglés'))).toEqual(['Inglés']);
  });

  it('encuentra por un trozo del nombre, no solo por el principio', () => {
    expect(nombres(filterDecks(mazos, 'tom'))).toEqual(['anatomía']);
  });

  it('ignora los espacios de los extremos del término buscado', () => {
    expect(nombres(filterDecks(mazos, '  quím  '))).toEqual(['Química']);
  });

  it('devuelve una lista vacía cuando nada coincide', () => {
    expect(filterDecks(mazos, 'alemán')).toEqual([]);
  });

  it('no modifica la lista recibida', () => {
    filterDecks(mazos, 'inglés');

    expect(mazos).toHaveLength(3);
  });
});

describe('sortDecks', () => {
  it('ordena por nombre A-Z sin que las mayúsculas manden', () => {
    expect(nombres(sortDecks(mazos, 'nombre-asc'))).toEqual(['anatomía', 'Inglés', 'Química']);
  });

  it('ordena por nombre Z-A', () => {
    expect(nombres(sortDecks(mazos, 'nombre-desc'))).toEqual(['Química', 'Inglés', 'anatomía']);
  });

  it('pone primero el modificado más recientemente', () => {
    expect(nombres(sortDecks(mazos, 'reciente'))).toEqual(['anatomía', 'Inglés', 'Química']);
  });

  it('pone primero el modificado hace más tiempo', () => {
    expect(nombres(sortDecks(mazos, 'antiguo'))).toEqual(['Química', 'Inglés', 'anatomía']);
  });

  it('mantiene el orden de entrada cuando dos mazos comparten fecha', () => {
    // Los mazos migrados desde la versión 1 del almacenamiento comparten marca temporal.
    const empatados: Deck[] = [
      { id: 'mazo-1', name: 'Primero', updatedAt: '2026-08-20T10:00:00.000Z' },
      { id: 'mazo-2', name: 'Segundo', updatedAt: '2026-08-20T10:00:00.000Z' },
    ];

    expect(nombres(sortDecks(empatados, 'reciente'))).toEqual(['Primero', 'Segundo']);
    expect(nombres(sortDecks(empatados, 'antiguo'))).toEqual(['Primero', 'Segundo']);
  });

  it('no modifica la lista recibida', () => {
    sortDecks(mazos, 'nombre-desc');

    expect(nombres(mazos)).toEqual(['Inglés', 'anatomía', 'Química']);
  });

  it('ofrece exactamente los cuatro criterios confirmados', () => {
    expect(deckSortOptions.map((option) => option.value)).toEqual([
      'nombre-asc',
      'nombre-desc',
      'reciente',
      'antiguo',
    ]);
  });
});

describe('buildDeckSummaries', () => {
  const library: Library = {
    decks: mazos,
    cards: [
      { id: 'carta-1', deckId: 'mazo-1', front: 'a', back: 'b' },
      { id: 'carta-2', deckId: 'mazo-1', front: 'c', back: 'd' },
      { id: 'carta-3', deckId: 'mazo-2', front: 'e', back: 'f' },
    ],
  };

  it('cuenta las cartas de cada mazo', () => {
    const summaries = buildDeckSummaries(library, '', 'nombre-asc');

    expect(summaries.map((summary) => [summary.deck.name, summary.cardCount])).toEqual([
      ['anatomía', 1],
      ['Inglés', 2],
      ['Química', 0],
    ]);
  });

  it('filtra y ordena a la vez', () => {
    const summaries = buildDeckSummaries(library, 'a', 'nombre-desc');

    expect(summaries.map((summary) => summary.deck.name)).toEqual(['Química', 'anatomía']);
  });
});

describe('formatUpdatedAt', () => {
  it('devuelve una fecha legible', () => {
    expect(formatUpdatedAt('2026-08-20T10:00:00.000Z')).toBeTruthy();
  });

  it('prefiere no mostrar nada antes que mostrar una fecha inválida', () => {
    expect(formatUpdatedAt('no es una fecha')).toBeUndefined();
    expect(formatUpdatedAt('')).toBeUndefined();
  });
});
