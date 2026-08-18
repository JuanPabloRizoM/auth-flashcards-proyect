import type { Card, Deck, Library } from '../../types/domain';

/**
 * Lógica de mazos y cartas. Funciones puras: reciben la biblioteca y devuelven una nueva,
 * sin tocar interfaz ni almacenamiento (docs/ARCHITECTURE.md, reglas 1 y 7).
 */

export type LibraryErrorCode =
  | 'nombre-requerido'
  | 'frente-requerido'
  | 'reverso-requerido'
  | 'mazo-inexistente';

export type LibraryResult =
  | { ok: true; library: Library }
  | { ok: false; error: LibraryErrorCode };

export const emptyLibrary: Library = { decks: [], cards: [] };

/** Mensajes de error orientados a la persona usuaria: qué pasó y qué hacer. */
const errorMessages: Record<LibraryErrorCode, string> = {
  'nombre-requerido': 'Escribe un nombre para el mazo.',
  'frente-requerido': 'Escribe el frente de la carta.',
  'reverso-requerido': 'Escribe el reverso de la carta.',
  'mazo-inexistente': 'Ese mazo ya no existe.',
};

export function libraryErrorMessage(error: LibraryErrorCode): string {
  return errorMessages[error];
}

export function createDeck(library: Library, name: string, id: string): LibraryResult {
  const trimmed = name.trim();

  if (trimmed.length === 0) {
    return { ok: false, error: 'nombre-requerido' };
  }

  // Los nombres repetidos se permiten: rechazarlos sería una decisión de producto que el
  // usuario no ha tomado. Queda anotado como pregunta abierta, no resuelto por el agente.
  const deck: Deck = { id, name: trimmed };
  return { ok: true, library: { ...library, decks: [...library.decks, deck] } };
}

export function addCard(
  library: Library,
  deckId: string,
  front: string,
  back: string,
  id: string,
): LibraryResult {
  if (!findDeck(library, deckId)) {
    return { ok: false, error: 'mazo-inexistente' };
  }

  const trimmedFront = front.trim();
  const trimmedBack = back.trim();

  if (trimmedFront.length === 0) {
    return { ok: false, error: 'frente-requerido' };
  }
  if (trimmedBack.length === 0) {
    return { ok: false, error: 'reverso-requerido' };
  }

  const card: Card = { id, deckId, front: trimmedFront, back: trimmedBack };
  return { ok: true, library: { ...library, cards: [...library.cards, card] } };
}

export function findDeck(library: Library, deckId: string): Deck | undefined {
  return library.decks.find((deck) => deck.id === deckId);
}

/** Cartas de un mazo, en el orden en que se crearon. */
export function cardsOfDeck(library: Library, deckId: string): Card[] {
  return library.cards.filter((card) => card.deckId === deckId);
}

export function countCardsOfDeck(library: Library, deckId: string): number {
  return cardsOfDeck(library, deckId).length;
}
