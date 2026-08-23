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
  addCards as addCardsTo,
  createDeck as createDeckIn,
  deleteCard as deleteCardIn,
  deleteDeck as deleteDeckIn,
  editCard as editCardIn,
  emptyLibrary,
  renameDeck as renameDeckIn,
  type LibraryErrorCode,
} from '../features/decks/library';
import type { ImportRow } from '../features/import/mapping';
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

/** Igual que `LibraryAction`, pero para operaciones que esperan a la escritura. */
export type AsyncLibraryAction =
  | { ok: true; imported: number }
  | { ok: false; error: LibraryErrorCode }
  | { ok: false; error: 'escritura-fallida' };

export type LibraryStatus = 'loading' | 'ready';

export type LibraryValue = {
  library: Library;
  status: LibraryStatus;
  /** Mensaje de un problema del almacenamiento, si lo hubo. La app sigue siendo usable. */
  storageError?: string;
  createDeck: (name: string) => LibraryAction;
  renameDeck: (deckId: string, name: string) => LibraryAction;
  deleteDeck: (deckId: string) => LibraryAction;
  addCard: (deckId: string, front: string, back: string) => LibraryAction;
  editCard: (cardId: string, front: string, back: string) => LibraryAction;
  deleteCard: (cardId: string) => LibraryAction;
  /**
   * Añade un lote de cartas esperando a que la escritura termine.
   *
   * A diferencia del resto, no publica el estado nuevo hasta que el almacenamiento confirma.
   * Es lo que garantiza que una importación fallida no deje el mazo a medias ni enseñe
   * tarjetas que en realidad no se guardaron.
   */
  importCards: (deckId: string, rows: readonly ImportRow[]) => Promise<AsyncLibraryAction>;
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
/**
 * Reloj monótono para las fechas de modificación.
 *
 * `Date.now()` tiene resolución de milisegundo, y dos operaciones seguidas caen de sobra
 * dentro del mismo. Con marcas empatadas, "modificado más reciente" no puede distinguir qué
 * se tocó antes, que es justo lo que la persona usuaria espera que distinga. Este reloj nunca
 * devuelve dos veces el mismo valor ni retrocede: si el sistema no ha avanzado, suma un
 * milisegundo. Como mucho se adelanta tantos milisegundos como operaciones seguidas haya, y
 * se reajusta solo en cuanto el reloj real lo alcanza.
 */
function createMonotonicClock(): {
  now: () => string;
  /** Coloca el reloj por delante de lo ya guardado al rehidratar. */
  seed: (isoDate: string | undefined) => void;
} {
  let last = 0;

  return {
    now: () => {
      const millis = Math.max(Date.now(), last + 1);
      last = millis;
      return new Date(millis).toISOString();
    },
    seed: (isoDate) => {
      const millis = isoDate === undefined ? Number.NaN : Date.parse(isoDate);
      if (!Number.isNaN(millis)) {
        last = Math.max(last, millis);
      }
    },
  };
}

/** La marca más alta ya guardada, para que la sesión nueva no emita fechas anteriores. */
function latestUpdatedAt(library: Library): string | undefined {
  return library.decks.reduce<string | undefined>(
    (latest, deck) => (latest === undefined || deck.updatedAt > latest ? deck.updatedAt : latest),
    undefined,
  );
}

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
  const clock = useRef(createMonotonicClock());
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
        clock.current.seed(latestUpdatedAt(result.library));
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

  /**
   * Aplica el resultado de una operación de dominio: si salió bien, se publica y se persiste.
   *
   * Está aquí para que las siete operaciones no repitan siete veces el mismo bloque y para
   * que la regla "un intento inválido no toca lo persistido" sea una sola línea de código.
   */
  const apply = useCallback(
    (result: { ok: true; library: Library } | { ok: false; error: LibraryErrorCode }) => {
      if (!result.ok) {
        return { ok: false as const, error: result.error };
      }
      setLibrary(result.library);
      persist(result.library);
      return { ok: true as const };
    },
    [persist],
  );

  const createDeck = useCallback(
    (name: string): LibraryAction => apply(createDeckIn(library, name, generateId('mazo'), clock.current.now())),
    [apply, generateId, library],
  );

  const renameDeck = useCallback(
    (deckId: string, name: string): LibraryAction => apply(renameDeckIn(library, deckId, name, clock.current.now())),
    [apply, library],
  );

  const deleteDeck = useCallback(
    (deckId: string): LibraryAction => apply(deleteDeckIn(library, deckId)),
    [apply, library],
  );

  const addCard = useCallback(
    (deckId: string, front: string, back: string): LibraryAction =>
      apply(addCardTo(library, deckId, front, back, generateId('carta'), clock.current.now())),
    [apply, generateId, library],
  );

  const editCard = useCallback(
    (cardId: string, front: string, back: string): LibraryAction =>
      apply(editCardIn(library, cardId, front, back, clock.current.now())),
    [apply, library],
  );

  const deleteCard = useCallback(
    (cardId: string): LibraryAction => apply(deleteCardIn(library, cardId, clock.current.now())),
    [apply, library],
  );

  const importCards = useCallback(
    async (deckId: string, rows: readonly ImportRow[]): Promise<AsyncLibraryAction> => {
      const ids = rows.map(() => generateId('carta'));
      const result = addCardsTo(library, deckId, rows, ids, clock.current.now());
      if (!result.ok) {
        return { ok: false, error: result.error };
      }

      // Se escribe antes de publicar. Si el medio falla, el estado visible no llega a incluir
      // las cartas nuevas y lo guardado sigue siendo exactamente lo que había.
      if (!writesSuspended.current) {
        try {
          await repositoryRef.current!.save(result.library);
        } catch {
          setStorageError('No se han podido guardar las tarjetas importadas en este dispositivo.');
          return { ok: false, error: 'escritura-fallida' };
        }
      }

      setLibrary(result.library);
      return { ok: true, imported: rows.length };
    },
    [generateId, library],
  );

  const value = useMemo<LibraryValue>(
    () => ({
      library,
      status,
      storageError,
      createDeck,
      renameDeck,
      deleteDeck,
      addCard,
      editCard,
      deleteCard,
      importCards,
    }),
    [
      addCard,
      createDeck,
      deleteCard,
      deleteDeck,
      editCard,
      importCards,
      library,
      renameDeck,
      status,
      storageError,
    ],
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
