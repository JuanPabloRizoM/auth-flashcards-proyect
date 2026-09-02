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
  applyScheduling,
  createDeck as createDeckIn,
  deleteCard as deleteCardIn,
  deleteDeck as deleteDeckIn,
  editCard as editCardIn,
  emptyLibrary,
  renameDeck as renameDeckIn,
  type LibraryErrorCode,
} from '../features/decks/library';
import type { ImportRow } from '../features/import/mapping';
import { appScheduler } from '../features/scheduler';
import type { CardScheduling } from '../features/scheduler/types';
import type { Library, SchedulerMetadata } from '../types/domain';

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

/**
 * Igual que `LibraryAction`, pero devolviendo el identificador de la carta creada.
 *
 * Lo necesita el registro del historial: para anotar el alta de una carta con su origen
 * hace falta su `id`, y solo el proveedor lo conoce, porque es quien lo emite. Deducirlo
 * mirando "la última carta del mazo" sería frágil y quedaría mal en cuanto dos altas se
 * solaparan.
 */
export type AddCardAction = { ok: true; cardId: string } | { ok: false; error: LibraryErrorCode };

/** Igual que `LibraryAction`, pero para operaciones que esperan a la escritura. */
export type AsyncLibraryAction =
  | { ok: true; imported: number; cardIds: string[] }
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
  addCard: (deckId: string, front: string, back: string) => AddCardAction;
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
  /**
   * Guarda la programación de una carta y espera a que llegue al medio.
   *
   * A diferencia del resto de operaciones, no publica el estado nuevo hasta que el
   * almacenamiento confirma: calificar tiene que poder fallar de forma visible, y avanzar de
   * carta sobre una escritura que no ocurrió dejaría la sesión adelantada respecto a lo
   * guardado. También es lo que permite revertir la programación si después falla el
   * historial (ver src/features/study/review.ts).
   */
  saveCardScheduling: (cardId: string, scheduling: CardScheduling) => Promise<boolean>;
};

const LibraryContext = createContext<LibraryValue | null>(null);

export type LibraryProviderProps = {
  children: ReactNode;
  /**
   * De dónde se leen y a dónde se escriben los datos.
   *
   * Obligatorio desde TASK-008: la clave depende de quién ha iniciado sesión, así que ya no
   * existe un repositorio por defecto que el proveedor pueda fabricarse. Quien lo monta es
   * `UserScopedData`, que sabe el `user.id`. En los tests, el arnés inyecta el suyo.
   */
  repository: LibraryRepository;
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

/**
 * Metadata del scheduler activo.
 *
 * Se sella en cada escritura para que el documento guardado diga siempre con qué algoritmo,
 * con qué versión y con qué parámetros se calcularon sus vencimientos. Una migración futura
 * podrá compararla en vez de adivinar (docs/PRODUCT.md, 2026-08-30).
 */
const schedulerMetadata: SchedulerMetadata = {
  id: appScheduler.id,
  version: appScheduler.version,
  parameters: appScheduler.parameters,
};

function stamped(library: Library): Library {
  return { ...library, scheduler: schedulerMetadata };
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
  const repositoryRef = useRef<LibraryRepository>(repository);

  const [library, setLibrary] = useState<Library>(emptyLibrary);
  /**
   * La biblioteca más reciente, legible desde callbacks sin recrearlos.
   *
   * Calificar dos cartas seguidas ocurre más rápido de lo que React vuelve a pintar. Con
   * solo el valor capturado en el closure, la segunda calificación partiría de la
   * biblioteca anterior y borraría la primera.
   */
  const libraryRef = useRef<Library>(emptyLibrary);
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
      const result = await activeRepository.load();
      if (cancelled) return;

      if (result.status === 'ok') {
        libraryRef.current = result.library;
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
    repositoryRef.current.save(next).catch(() => {
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
      const next = stamped(result.library);
      libraryRef.current = next;
      setLibrary(next);
      persist(next);
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
    (deckId: string, front: string, back: string): AddCardAction => {
      const cardId = generateId('carta');
      const result = apply(addCardTo(library, deckId, front, back, cardId, clock.current.now()));
      return result.ok ? { ok: true, cardId } : result;
    },
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
      const next = stamped(result.library);
      if (!writesSuspended.current) {
        try {
          await repositoryRef.current.save(next);
        } catch {
          setStorageError('No se han podido guardar las tarjetas importadas en este dispositivo.');
          return { ok: false, error: 'escritura-fallida' };
        }
      }

      libraryRef.current = next;
      setLibrary(next);
      return { ok: true, imported: rows.length, cardIds: ids };
    },
    [generateId, library],
  );

  const saveCardScheduling = useCallback(
    async (cardId: string, scheduling: CardScheduling): Promise<boolean> => {
      const result = applyScheduling(libraryRef.current, cardId, scheduling);
      if (!result.ok) {
        return false;
      }

      const next = stamped(result.library);
      // Se escribe antes de publicar. Si el medio falla, ni el estado visible ni lo guardado
      // incluyen la calificación, y quien llama decide qué hacer.
      if (!writesSuspended.current) {
        try {
          await repositoryRef.current.save(next);
        } catch {
          setStorageError('No se han podido guardar los últimos cambios en este dispositivo.');
          return false;
        }
      }

      libraryRef.current = next;
      setLibrary(next);
      return true;
    },
    [],
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
      saveCardScheduling,
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
      saveCardScheduling,
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
