import type { Deck, Library } from '../../types/domain';

import { countCardsOfDeck } from './library';

/**
 * Presentación de la biblioteca: búsqueda y orden de Mis mazos.
 *
 * Funciones puras, fuera de la pantalla, para poder demostrar el orden y el filtrado sin
 * montar interfaz (docs/ARCHITECTURE.md, reglas 1 y 7).
 */

/** Los cuatro criterios confirmados. No hay más y no se inventan. */
export type DeckSortOrder = 'nombre-asc' | 'nombre-desc' | 'reciente' | 'antiguo';

export const deckSortOptions: readonly { value: DeckSortOrder; label: string }[] = [
  { value: 'nombre-asc', label: 'Nombre A-Z' },
  { value: 'nombre-desc', label: 'Nombre Z-A' },
  { value: 'reciente', label: 'Modificado más reciente' },
  { value: 'antiguo', label: 'Modificado más antiguo' },
] as const;

export const defaultDeckSortOrder: DeckSortOrder = 'nombre-asc';

/** Un mazo tal y como lo necesita la lista: con su recuento de cartas ya resuelto. */
export type DeckSummary = {
  deck: Deck;
  cardCount: number;
};

/**
 * Filtra por nombre ignorando mayúsculas y espacios de los extremos del término buscado.
 *
 * Es una coincidencia por subcadena, no por prefijo: buscar "gles" encuentra "Inglés" salvo
 * por el acento. Deliberadamente no se quitan acentos aquí: la comparación de nombres de mazo
 * del proyecto solo recorta y baja a minúsculas, y no se introduce una segunda regla distinta.
 */
export function filterDecks(decks: readonly Deck[], query: string): Deck[] {
  const needle = query.trim().toLocaleLowerCase();
  if (needle.length === 0) {
    return [...decks];
  }
  return decks.filter((deck) => deck.name.toLocaleLowerCase().includes(needle));
}

/**
 * Ordena una copia, sin tocar el original.
 *
 * Los empates conservan el orden de entrada: `Array.prototype.sort` es estable, así que dos
 * mazos con la misma fecha (los que vienen migrados de la versión 1 del almacenamiento, por
 * ejemplo) mantienen entre sí el orden de creación en vez de bailar entre renders.
 */
export function sortDecks(decks: readonly Deck[], order: DeckSortOrder): Deck[] {
  const compareByName = (a: Deck, b: Deck) => a.name.localeCompare(b.name);

  switch (order) {
    case 'nombre-asc':
      return [...decks].sort(compareByName);
    case 'nombre-desc':
      return [...decks].sort((a, b) => compareByName(b, a));
    case 'reciente':
      return [...decks].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    case 'antiguo':
      return [...decks].sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
  }
}

/** Lo que se pinta en Mis mazos: filtrado, ordenado y con el recuento de cartas resuelto. */
export function buildDeckSummaries(
  library: Library,
  query: string,
  order: DeckSortOrder,
): DeckSummary[] {
  return sortDecks(filterDecks(library.decks, query), order).map((deck) => ({
    deck,
    cardCount: countCardsOfDeck(library, deck.id),
  }));
}

/**
 * Fecha de modificación en formato corto y local.
 *
 * Si la marca guardada no es una fecha utilizable se devuelve `undefined` en vez de
 * "Invalid Date": es preferible no mostrar el dato a mostrar basura.
 */
export function formatUpdatedAt(updatedAt: string): string | undefined {
  const date = new Date(updatedAt);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}
