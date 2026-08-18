import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';

import {
  addCard as addCardTo,
  createDeck as createDeckIn,
  emptyLibrary,
  type LibraryErrorCode,
} from '../features/decks/library';
import type { Library } from '../types/domain';

/**
 * Acceso a datos centralizado (docs/ARCHITECTURE.md, regla 2).
 *
 * Los datos viven en memoria: no hay base de datos ni persistencia porque esa decisión
 * todavía no está tomada (docs/PRODUCT.md). Al recargar la página se pierden.
 * Cuando exista una decisión de almacenamiento, solo cambia este archivo: la lógica de
 * `features/` y las pantallas no dependen de dónde vive el estado.
 */

export type LibraryAction = { ok: true } | { ok: false; error: LibraryErrorCode };

export type LibraryValue = {
  library: Library;
  createDeck: (name: string) => LibraryAction;
  addCard: (deckId: string, front: string, back: string) => LibraryAction;
};

const LibraryContext = createContext<LibraryValue | null>(null);

export function LibraryProvider({ children }: { children: ReactNode }) {
  const [library, setLibrary] = useState<Library>(emptyLibrary);
  // Contador propio en vez de aleatorio: los identificadores son predecibles en tests.
  const nextId = useRef(0);

  const generateId = useCallback((prefix: string) => {
    nextId.current += 1;
    return `${prefix}-${nextId.current}`;
  }, []);

  const createDeck = useCallback(
    (name: string): LibraryAction => {
      const result = createDeckIn(library, name, generateId('mazo'));
      if (!result.ok) {
        return { ok: false, error: result.error };
      }
      setLibrary(result.library);
      return { ok: true };
    },
    [generateId, library],
  );

  const addCard = useCallback(
    (deckId: string, front: string, back: string): LibraryAction => {
      const result = addCardTo(library, deckId, front, back, generateId('carta'));
      if (!result.ok) {
        return { ok: false, error: result.error };
      }
      setLibrary(result.library);
      return { ok: true };
    },
    [generateId, library],
  );

  const value = useMemo<LibraryValue>(
    () => ({ library, createDeck, addCard }),
    [addCard, createDeck, library],
  );

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}

export function useLibrary(): LibraryValue {
  const value = useContext(LibraryContext);
  if (!value) {
    throw new Error('useLibrary debe usarse dentro de LibraryProvider.');
  }
  return value;
}
