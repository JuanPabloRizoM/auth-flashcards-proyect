import {
  addCard,
  cardsOfDeck,
  countCardsOfDeck,
  createDeck,
  emptyLibrary,
  findDeck,
  libraryErrorMessage,
} from '../../src/features/decks/library';

function libraryConMazo(name = 'Inglés') {
  const result = createDeck(emptyLibrary, name, 'mazo-1');
  if (!result.ok) {
    throw new Error('el mazo de partida debería crearse');
  }
  return result.library;
}

describe('createDeck', () => {
  it('añade el mazo con el nombre recortado', () => {
    const result = createDeck(emptyLibrary, '  Inglés  ', 'mazo-1');

    expect(result).toEqual({
      ok: true,
      library: { decks: [{ id: 'mazo-1', name: 'Inglés' }], cards: [] },
    });
  });

  it('no modifica la biblioteca recibida', () => {
    createDeck(emptyLibrary, 'Inglés', 'mazo-1');

    expect(emptyLibrary.decks).toEqual([]);
  });

  it('rechaza un nombre vacío', () => {
    expect(createDeck(emptyLibrary, '', 'mazo-1')).toEqual({
      ok: false,
      error: 'nombre-requerido',
    });
  });

  it('rechaza un nombre que solo tiene espacios', () => {
    expect(createDeck(emptyLibrary, '   ', 'mazo-1')).toEqual({
      ok: false,
      error: 'nombre-requerido',
    });
  });

  // Rechazar nombres repetidos sería una decisión de producto que el usuario no ha tomado.
  it('permite un nombre repetido, porque nadie ha decidido prohibirlo', () => {
    const library = libraryConMazo('Inglés');
    const result = createDeck(library, 'Inglés', 'mazo-2');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.library.decks).toHaveLength(2);
    }
  });

  it('permite dos mazos con nombres distintos', () => {
    const library = libraryConMazo('Inglés');
    const result = createDeck(library, 'Alemán', 'mazo-2');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.library.decks.map((deck) => deck.name)).toEqual(['Inglés', 'Alemán']);
    }
  });
});

describe('addCard', () => {
  it('añade la carta al mazo indicado, con los textos recortados', () => {
    const library = libraryConMazo();
    const result = addCard(library, 'mazo-1', '  to overlook ', ' pasar por alto ', 'carta-1');

    expect(result).toEqual({
      ok: true,
      library: {
        decks: [{ id: 'mazo-1', name: 'Inglés' }],
        cards: [{ id: 'carta-1', deckId: 'mazo-1', front: 'to overlook', back: 'pasar por alto' }],
      },
    });
  });

  it('rechaza un frente vacío', () => {
    const library = libraryConMazo();

    expect(addCard(library, 'mazo-1', '   ', 'pasar por alto', 'carta-1')).toEqual({
      ok: false,
      error: 'frente-requerido',
    });
  });

  it('rechaza un reverso vacío', () => {
    const library = libraryConMazo();

    expect(addCard(library, 'mazo-1', 'to overlook', '', 'carta-1')).toEqual({
      ok: false,
      error: 'reverso-requerido',
    });
  });

  it('rechaza añadir a un mazo que no existe', () => {
    expect(addCard(emptyLibrary, 'mazo-inventado', 'frente', 'reverso', 'carta-1')).toEqual({
      ok: false,
      error: 'mazo-inexistente',
    });
  });
});

describe('consultas', () => {
  it('devuelve solo las cartas del mazo pedido', () => {
    let library = libraryConMazo('Inglés');
    const conSegundoMazo = createDeck(library, 'Alemán', 'mazo-2');
    if (!conSegundoMazo.ok) throw new Error('debería crearse');
    library = conSegundoMazo.library;

    const conCartaIngles = addCard(library, 'mazo-1', 'to overlook', 'pasar por alto', 'carta-1');
    if (!conCartaIngles.ok) throw new Error('debería crearse');
    library = conCartaIngles.library;

    const conCartaAleman = addCard(library, 'mazo-2', 'übersehen', 'pasar por alto', 'carta-2');
    if (!conCartaAleman.ok) throw new Error('debería crearse');
    library = conCartaAleman.library;

    expect(cardsOfDeck(library, 'mazo-1').map((card) => card.front)).toEqual(['to overlook']);
    expect(cardsOfDeck(library, 'mazo-2').map((card) => card.front)).toEqual(['übersehen']);
    expect(countCardsOfDeck(library, 'mazo-1')).toBe(1);
  });

  it('encuentra un mazo por su identificador y devuelve undefined si no existe', () => {
    const library = libraryConMazo();

    expect(findDeck(library, 'mazo-1')?.name).toBe('Inglés');
    expect(findDeck(library, 'mazo-9')).toBeUndefined();
  });

  it('cuenta cero cartas en un mazo recién creado', () => {
    expect(countCardsOfDeck(libraryConMazo(), 'mazo-1')).toBe(0);
  });
});

describe('libraryErrorMessage', () => {
  it('da un mensaje accionable para cada error', () => {
    expect(libraryErrorMessage('nombre-requerido')).toBe('Escribe un nombre para el mazo.');
    expect(libraryErrorMessage('frente-requerido')).toBe('Escribe el frente de la carta.');
    expect(libraryErrorMessage('reverso-requerido')).toBe('Escribe el reverso de la carta.');
    expect(libraryErrorMessage('mazo-inexistente')).toBe('Ese mazo ya no existe.');
  });
});
