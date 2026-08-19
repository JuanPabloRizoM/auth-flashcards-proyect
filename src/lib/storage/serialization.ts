import type { Card, Deck, Library } from '../../types/domain';

import type { LoadResult } from './types';

/**
 * Serialización del almacenamiento local.
 *
 * Forma persistida, deliberadamente simple: un único documento JSON.
 *
 * ```json
 * { "version": 1, "decks": [{ "id": "...", "name": "..." }],
 *   "cards": [{ "id": "...", "deckId": "...", "front": "...", "back": "..." }] }
 * ```
 *
 * Un solo documento evita escrituras parciales que dejarían cartas sin su mazo.
 * No hay sistema de migraciones: todavía no hay ninguna versión anterior que migrar.
 * Si algún día la hay, `version` es el punto por donde entrará.
 */
export const STORAGE_VERSION = 1;

export function serializeLibrary(library: Library): string {
  return JSON.stringify({
    version: STORAGE_VERSION,
    decks: library.decks,
    cards: library.cards,
  });
}

function isDeck(value: unknown): value is Deck {
  if (typeof value !== 'object' || value === null) return false;
  const deck = value as Record<string, unknown>;
  return typeof deck.id === 'string' && typeof deck.name === 'string';
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
 */
export function parseStoredLibrary(raw: string | null): LoadResult {
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

  if (document.version !== STORAGE_VERSION) {
    return { status: 'error', reason: 'contenido-invalido' };
  }
  if (!Array.isArray(document.decks) || !Array.isArray(document.cards)) {
    return { status: 'error', reason: 'contenido-invalido' };
  }
  if (!document.decks.every(isDeck) || !document.cards.every(isCard)) {
    return { status: 'error', reason: 'contenido-invalido' };
  }

  const library: Library = {
    decks: document.decks as Deck[],
    cards: document.cards as Card[],
  };
  return { status: 'ok', library };
}
