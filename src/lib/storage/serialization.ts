import type { Card, Deck, Library } from '../../types/domain';

import type { LoadResult } from './types';

/**
 * Serialización del almacenamiento local.
 *
 * Forma persistida, deliberadamente simple: un único documento JSON.
 *
 * ```json
 * { "version": 2, "decks": [{ "id": "...", "name": "...", "updatedAt": "..." }],
 *   "cards": [{ "id": "...", "deckId": "...", "front": "...", "back": "..." }] }
 * ```
 *
 * Un solo documento evita escrituras parciales que dejarían cartas sin su mazo.
 *
 * La versión 1 es la que escribió TASK-004: idéntica, pero sin `updatedAt` en los mazos.
 * Se sigue leyendo y se migra al vuelo. Subir la versión sin migrar habría marcado como
 * inválida la biblioteca de quien ya estuviera usando la aplicación.
 */
export const STORAGE_VERSION = 2;

/** Versiones que esta build sabe leer. Escribir, escribe siempre la actual. */
const READABLE_VERSIONS = [1, STORAGE_VERSION];

export function serializeLibrary(library: Library): string {
  return JSON.stringify({
    version: STORAGE_VERSION,
    decks: library.decks,
    cards: library.cards,
  });
}

/** Mazo de la versión 1: sin `updatedAt`. */
function isDeckV1(value: unknown): value is Omit<Deck, 'updatedAt'> {
  if (typeof value !== 'object' || value === null) return false;
  const deck = value as Record<string, unknown>;
  return typeof deck.id === 'string' && typeof deck.name === 'string';
}

function isDeckV2(value: unknown): value is Deck {
  return isDeckV1(value) && typeof (value as Record<string, unknown>).updatedAt === 'string';
}

function isCard(value: unknown): value is Card {
  if (typeof value !== 'object' || value === null) return false;
  const card = value as Record<string, unknown>;
  return (
    typeof card.id === 'string' &&
    typeof card.deckId === 'string' &&
    typeof card.front === 'string' &&
    typeof card.back === 'string'
  );
}

/**
 * Convierte lo leído del almacenamiento en un resultado utilizable.
 *
 * `null` significa que no había nada guardado, que no es un error.
 * Cualquier otra cosa que no encaje se reporta como contenido inválido: no se descarta
 * el original, solo se deja de usar hasta que la persona usuaria escriba encima.
 *
 * `now` es la marca que reciben los mazos migrados desde la versión 1, que no guardaba
 * ninguna fecha. Se inyecta para que los tests puedan afirmar sobre un valor concreto en
 * vez de sobre "más o menos ahora".
 */
export function parseStoredLibrary(
  raw: string | null,
  now: string = new Date().toISOString(),
): LoadResult {
  if (raw === null || raw === '') {
    return { status: 'empty' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { status: 'error', reason: 'contenido-invalido' };
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { status: 'error', reason: 'contenido-invalido' };
  }

  const document = parsed as Record<string, unknown>;

  const version = document.version;
  if (typeof version !== 'number' || !READABLE_VERSIONS.includes(version)) {
    return { status: 'error', reason: 'contenido-invalido' };
  }
  if (!Array.isArray(document.decks) || !Array.isArray(document.cards)) {
    return { status: 'error', reason: 'contenido-invalido' };
  }
  if (!document.cards.every(isCard)) {
    return { status: 'error', reason: 'contenido-invalido' };
  }

  // La versión 1 no guardaba fecha de modificación y no hay forma de deducirla: todos los
  // mazos migrados reciben la misma marca. Entre ellos, el orden por modificación queda en
  // manos del desempate estable por posición.
  let decks: Deck[];
  if (version === 1) {
    if (!document.decks.every(isDeckV1)) {
      return { status: 'error', reason: 'contenido-invalido' };
    }
    decks = (document.decks as Omit<Deck, 'updatedAt'>[]).map((deck) => ({
      id: deck.id,
      name: deck.name,
      updatedAt: now,
    }));
  } else {
    if (!document.decks.every(isDeckV2)) {
      return { status: 'error', reason: 'contenido-invalido' };
    }
    decks = document.decks as Deck[];
  }

  return { status: 'ok', library: { decks, cards: document.cards as Card[] } };
}
