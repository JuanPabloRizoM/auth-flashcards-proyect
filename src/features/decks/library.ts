import { newScheduling, type CardScheduling } from '../scheduler/types';

import type { Card, Deck, Library } from '../../types/domain';

/**
 * Lógica de mazos y cartas. Funciones puras: reciben la biblioteca y devuelven una nueva,
 * sin tocar interfaz ni almacenamiento (docs/ARCHITECTURE.md, reglas 1 y 7).
 *
 * Las operaciones que cambian un mazo o su contenido reciben `now` y actualizan el
 * `updatedAt` de ese mazo. El reloj se pasa desde fuera, nunca se lee aquí dentro: así un
 * test puede afirmar sobre una fecha concreta en lugar de sobre "más o menos ahora".
 */

export type LibraryErrorCode =
  | 'nombre-requerido'
  | 'nombre-duplicado'
  | 'frente-requerido'
  | 'reverso-requerido'
  | 'mazo-inexistente'
  | 'carta-inexistente'
  | 'sin-cartas-validas';

export type LibraryResult =
  | { ok: true; library: Library }
  | { ok: false; error: LibraryErrorCode };

export const emptyLibrary: Library = { decks: [], cards: [], scheduler: null };

/** Mensajes de error orientados a la persona usuaria: qué pasó y qué hacer. */
const errorMessages: Record<LibraryErrorCode, string> = {
  'nombre-requerido': 'Escribe un nombre para el mazo.',
  'nombre-duplicado': 'Ya tienes un mazo con ese nombre. Elige otro.',
  'frente-requerido': 'Escribe el frente de la carta.',
  'reverso-requerido': 'Escribe el reverso de la carta.',
  'mazo-inexistente': 'Ese mazo ya no existe.',
  'carta-inexistente': 'Esa carta ya no existe.',
  'sin-cartas-validas': 'No hay ninguna carta válida que añadir.',
};

export function libraryErrorMessage(error: LibraryErrorCode): string {
  return errorMessages[error];
}

/**
 * Clave de comparación de nombres de mazo.
 *
 * Normalización confirmada por el usuario, y solo esta: recortar los espacios de los extremos
 * y comparar sin distinguir mayúsculas de minúsculas. Deliberadamente NO se colapsan los
 * espacios interiores ni se quitan acentos: serían normalizaciones no confirmadas.
 */
export function deckNameKey(name: string): string {
  return name.trim().toLocaleLowerCase();
}

/** Marca un mazo como modificado. Los demás se devuelven tal cual, sin copiarse. */
function touchDeck(decks: Deck[], deckId: string, now: string): Deck[] {
  return decks.map((deck) => (deck.id === deckId ? { ...deck, updatedAt: now } : deck));
}

/**
 * ¿Hay otro mazo llamado así?
 *
 * `exceptDeckId` es lo que permite que renombrar un mazo conservando su propio nombre siga
 * siendo válido, incluso cambiando solo mayúsculas o espacios de los extremos.
 */
function nameTakenByAnother(library: Library, name: string, exceptDeckId?: string): boolean {
  const key = deckNameKey(name);
  return library.decks.some((deck) => deck.id !== exceptDeckId && deckNameKey(deck.name) === key);
}

export function createDeck(
  library: Library,
  name: string,
  id: string,
  now: string = new Date().toISOString(),
): LibraryResult {
  const trimmed = name.trim();

  if (trimmed.length === 0) {
    return { ok: false, error: 'nombre-requerido' };
  }

  if (nameTakenByAnother(library, trimmed)) {
    return { ok: false, error: 'nombre-duplicado' };
  }

  const deck: Deck = { id, name: trimmed, updatedAt: now };
  return { ok: true, library: { ...library, decks: [...library.decks, deck] } };
}

/**
 * Renombra un mazo conservando su identidad.
 *
 * No se recrea el mazo con un id nuevo: sus cartas apuntan a este id y recrearlo las dejaría
 * huérfanas. Solo cambian el nombre y la fecha de modificación.
 */
export function renameDeck(
  library: Library,
  deckId: string,
  name: string,
  now: string = new Date().toISOString(),
): LibraryResult {
  if (!findDeck(library, deckId)) {
    return { ok: false, error: 'mazo-inexistente' };
  }

  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return { ok: false, error: 'nombre-requerido' };
  }

  if (nameTakenByAnother(library, trimmed, deckId)) {
    return { ok: false, error: 'nombre-duplicado' };
  }

  return {
    ok: true,
    library: {
      ...library,
      decks: library.decks.map((deck) =>
        deck.id === deckId ? { ...deck, name: trimmed, updatedAt: now } : deck,
      ),
    },
  };
}

/**
 * Elimina un mazo y, en cascada, todas sus cartas.
 *
 * La cascada es una decisión de producto confirmada: una carta no existe fuera de su mazo,
 * así que dejarlas sueltas produciría filas inalcanzables que nadie podría volver a ver.
 * Los demás mazos y sus cartas quedan intactos.
 */
export function deleteDeck(library: Library, deckId: string): LibraryResult {
  if (!findDeck(library, deckId)) {
    return { ok: false, error: 'mazo-inexistente' };
  }

  return {
    ok: true,
    library: {
      ...library,
      decks: library.decks.filter((deck) => deck.id !== deckId),
      cards: library.cards.filter((card) => card.deckId !== deckId),
    },
  };
}

export function addCard(
  library: Library,
  deckId: string,
  front: string,
  back: string,
  id: string,
  now: string = new Date().toISOString(),
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

  // Una carta nace siempre como Nueva para el scheduler, se cree a mano o se importe
  // (docs/PRODUCT.md, 2026-08-30).
  const card: Card = {
    id,
    deckId,
    front: trimmedFront,
    back: trimmedBack,
    scheduling: { ...newScheduling },
  };
  return {
    ok: true,
    library: {
      ...library,
      decks: touchDeck(library.decks, deckId, now),
      cards: [...library.cards, card],
    },
  };
}

/**
 * Añade varias cartas de una vez, para la importación.
 *
 * O entran todas o no entra ninguna: se valida el lote entero antes de construir la
 * biblioteca nueva, de modo que un lote con una fila mala no deja el mazo a medias.
 */
export function addCards(
  library: Library,
  deckId: string,
  drafts: readonly { front: string; back: string }[],
  ids: readonly string[],
  now: string = new Date().toISOString(),
): LibraryResult {
  if (!findDeck(library, deckId)) {
    return { ok: false, error: 'mazo-inexistente' };
  }
  if (drafts.length === 0) {
    return { ok: false, error: 'sin-cartas-validas' };
  }
  if (ids.length !== drafts.length) {
    // Programación, no entrada de la persona usuaria: quien llama debe emitir un id por carta.
    throw new Error('addCards necesita exactamente un identificador por carta.');
  }

  const cards: Card[] = [];
  for (const [index, draft] of drafts.entries()) {
    const front = draft.front.trim();
    const back = draft.back.trim();
    if (front.length === 0) {
      return { ok: false, error: 'frente-requerido' };
    }
    if (back.length === 0) {
      return { ok: false, error: 'reverso-requerido' };
    }
    cards.push({ id: ids[index]!, deckId, front, back, scheduling: { ...newScheduling } });
  }

  return {
    ok: true,
    library: {
      ...library,
      decks: touchDeck(library.decks, deckId, now),
      cards: [...library.cards, ...cards],
    },
  };
}

/**
 * Edita el contenido de una carta existente.
 *
 * La carta conserva su id y su mazo: es la misma carta con otro contenido, no una carta nueva.
 */
export function editCard(
  library: Library,
  cardId: string,
  front: string,
  back: string,
  now: string = new Date().toISOString(),
): LibraryResult {
  const existing = findCard(library, cardId);
  if (!existing) {
    return { ok: false, error: 'carta-inexistente' };
  }

  const trimmedFront = front.trim();
  const trimmedBack = back.trim();

  if (trimmedFront.length === 0) {
    return { ok: false, error: 'frente-requerido' };
  }
  if (trimmedBack.length === 0) {
    return { ok: false, error: 'reverso-requerido' };
  }

  return {
    ok: true,
    library: {
      ...library,
      decks: touchDeck(library.decks, existing.deckId, now),
      // Editar el contenido no toca la programación: sigue siendo la misma carta, con lo
      // que la persona usuaria ya ha aprendido de ella.
      cards: library.cards.map((card) =>
        card.id === cardId ? { ...card, front: trimmedFront, back: trimmedBack } : card,
      ),
    },
  };
}

/** Elimina una sola carta. El mazo y las demás cartas siguen donde estaban. */
export function deleteCard(
  library: Library,
  cardId: string,
  now: string = new Date().toISOString(),
): LibraryResult {
  const existing = findCard(library, cardId);
  if (!existing) {
    return { ok: false, error: 'carta-inexistente' };
  }

  return {
    ok: true,
    library: {
      ...library,
      decks: touchDeck(library.decks, existing.deckId, now),
      cards: library.cards.filter((card) => card.id !== cardId),
    },
  };
}

/**
 * Aplica a una carta el estado de scheduling que ha producido el scheduler.
 *
 * No cambia `updatedAt` del mazo: calificar no modifica el contenido del mazo, y hacerlo
 * reordenaría Mis mazos cada vez que alguien estudia, que no es lo que la fecha de
 * modificación significa.
 */
export function applyScheduling(
  library: Library,
  cardId: string,
  scheduling: CardScheduling,
): LibraryResult {
  if (!findCard(library, cardId)) {
    return { ok: false, error: 'carta-inexistente' };
  }
  return {
    ok: true,
    library: {
      ...library,
      cards: library.cards.map((card) => (card.id === cardId ? { ...card, scheduling } : card)),
    },
  };
}

export function findDeck(library: Library, deckId: string): Deck | undefined {
  return library.decks.find((deck) => deck.id === deckId);
}

export function findCard(library: Library, cardId: string): Card | undefined {
  return library.cards.find((card) => card.id === cardId);
}

/** Cartas de un mazo, en el orden en que se crearon. */
export function cardsOfDeck(library: Library, deckId: string): Card[] {
  return library.cards.filter((card) => card.deckId === deckId);
}

export function countCardsOfDeck(library: Library, deckId: string): number {
  return cardsOfDeck(library, deckId).length;
}
