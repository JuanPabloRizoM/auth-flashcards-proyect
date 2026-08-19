import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import {
  addCard as addCardTo,
  createDeck as createDeckIn,
  emptyLibrary,
  type LibraryErrorCode,
} from '../features/decks/library';
import type { Library } from '../types/domain';

import { createAsyncStorageRepository } from './storage/asyncStorageRepository';
import { storageErrorMessage, type LibraryRepository } from './storage/types';

/**
 * Acceso a datos centralizado (docs/ARCHITECTURE.md, regla 2).
 *
 * El proveedor es el único que habla con el repositorio, y el repositorio es el único que
 * conoce la tecnología de almacenamiento. Las pantallas solo usan `useLibrary`, así que
 * cambiar de almacenamiento no obliga a tocarlas.
 *
 * Al montar, hidrata desde el repositorio. Hasta que termina, el estado es `loading`: las
 * pantallas no deben presentar un estado vacío durante ese rato, porque sería falso.
 */

export type LibraryAction = { ok: true } | { ok: false; error: LibraryErrorCode };

export type LibraryStatus = 'loading' | 'ready';

export type LibraryValue = {
  library: Library;
  status: LibraryStatus;
  /** Mensaje de un problema del almacenamiento, si lo hubo. La app sigue siendo usable. */
  storageError?: string;
  createDeck: (name: string) => LibraryAction;
  addCard: (deckId: string, front: string, back: string) => LibraryAction;
};

const LibraryContext = createContext<LibraryValue | null>(null);

export type LibraryProviderProps = {
  children: ReactNode;
  /** Inyectable para poder probar con otra implementación del mismo contrato. */
  repository?: LibraryRepository;
};

/**
 * Siguiente número de identificador, deducido del mayor ya emitido.
 *
 * No sirve contar cuántos hay: un intento rechazado consume un número sin llegar a guardar
 * nada, así que el contador siempre va por delante del recuento. Si al rehidratar se
 * reiniciara con el recuento, se volverían a emitir identificadores ya usados y dos mazos
 * distintos acabarían compartiendo id.
 */
function nextCounterFrom(library: Library): number {
  const suffixOf = (id: string): number => {
    const match = /-(\d+)$/.exec(id);
    return match?.[1] ? Number(match[1]) : 0;
  };

  return [...library.decks, ...library.cards].reduce(
    (highest, entity) => Math.max(highest, suffixOf(entity.id)),
    0,
  );
}

export function LibraryProvider({ children, repository }: LibraryProviderProps) {
  const repositoryRef = useRef<LibraryRepository | null>(repository ?? null);
  if (repositoryRef.current === null) {
    repositoryRef.current = createAsyncStorageRepository();
  }

  const [library, setLibrary] = useState<Library>(emptyLibrary);
  const [status, setStatus] = useState<LibraryStatus>('loading');
  const [storageError, setStorageError] = useState<string | undefined>(undefined);
  const nextId = useRef(0);
  /**
   * Si no se pudo leer el medio, puede haber datos válidos ahí abajo. Guardar encima los
   * destruiría, así que se suspende la escritura durante esta sesión.
   */
  const writesSuspended = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const activeRepository = repositoryRef.current;

    const hydrate = async () => {
      const result = await activeRepository!.load();
      if (cancelled) return;

      if (result.status === 'ok') {
        setLibrary(result.library);
        nextId.current = nextCounterFrom(result.library);
      } else if (result.status === 'error') {
        if (result.reason === 'ilegible') {
          writesSuspended.current = true;
        }
        setStorageError(storageErrorMessage(result.reason));
      }
      setStatus('ready');
    };

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, []);

  const generateId = useCallback((prefix: string) => {
    nextId.current += 1;
    return `${prefix}-${nextId.current}`;
  }, []);

  /** Persiste sin bloquear la interfaz. Un fallo se comunica, no rompe la aplicación. */
  const persist = useCallback((next: Library) => {
    if (writesSuspended.current) {
      return;
    }
    repositoryRef.current!.save(next).catch(() => {
      setStorageError('No se han podido guardar los últimos cambios en este dispositivo.');
    });
  }, []);

  const createDeck = useCallback(
    (name: string): LibraryAction => {
      const result = createDeckIn(library, name, generateId('mazo'));
      if (!result.ok) {
        // Un intento inválido no toca lo persistido. Solo deja un hueco en la numeración.
        return { ok: false, error: result.error };
      }
      setLibrary(result.library);
      persist(result.library);
      return { ok: true };
    },
    [generateId, library, persist],
  );

  const addCard = useCallback(
    (deckId: string, front: string, back: string): LibraryAction => {
      const result = addCardTo(library, deckId, front, back, generateId('carta'));
      if (!result.ok) {
        return { ok: false, error: result.error };
      }
      setLibrary(result.library);
      persist(result.library);
      return { ok: true };
    },
    [generateId, library, persist],
  );

  const value = useMemo<LibraryValue>(
    () => ({ library, status, storageError, createDeck, addCard }),
    [addCard, createDeck, library, status, storageError],
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
