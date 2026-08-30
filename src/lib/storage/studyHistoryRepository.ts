import AsyncStorage from '@react-native-async-storage/async-storage';

import type {
  CardAddedEvent,
  DeckSnapshot,
  StudyCardEvent,
  StudyHistory,
  StudyReviewEvent,
  StudySession,
} from '../../features/stats/types';
import { emptyHistory } from '../../features/stats/types';

import {
  emptyMeta,
  emptyPartition,
  HISTORY_META_KEY,
  isMonthKey,
  mergeHistory,
  monthKey,
  monthOfEntry,
  monthOfKey,
  parseMeta,
  parsePartition,
  serializeMeta,
  serializePartition,
  upsertById,
  type HistoryMeta,
  type HistoryPartition,
} from './historySerialization';

/**
 * Contrato de almacenamiento del historial de estudio.
 *
 * Deliberadamente separado de `LibraryRepository`: la biblioteca es un estado pequeño que
 * se reescribe entero, y el historial es una bitácora que solo crece. Meterlos en el mismo
 * documento obligaría a reescribir todo el historial cada vez que se renombra un mazo, y a
 * borrar historial cada vez que se borra un mazo, que es justo lo contrario de lo pedido.
 */
export type StudyHistoryRepository = {
  load: () => Promise<HistoryLoadResult>;
  /** Añade o actualiza registros. Solo toca las particiones de los meses implicados. */
  append: (patch: HistoryPatch) => Promise<void>;
  /**
   * Se resuelve cuando no queda ninguna escritura pendiente.
   *
   * Registrar no bloquea la interfaz: quien llama a `append` no espera. Esto permite que
   * un test, o un cierre ordenado, sepan cuándo lo escrito está de verdad en el medio.
   */
  flush: () => Promise<void>;
};

export type HistoryPatch = {
  /** Se fija la primera vez que se activa el tracking y nunca se mueve después. */
  trackedSince?: number;
  /** Se fija con la primera calificación y nunca se mueve después. */
  ratedSince?: number;
  sessions?: readonly StudySession[];
  cardEvents?: readonly StudyCardEvent[];
  cardAdditions?: readonly CardAddedEvent[];
  reviews?: readonly StudyReviewEvent[];
  deckSnapshots?: readonly DeckSnapshot[];
};

export type HistoryLoadResult =
  | { status: 'ok'; history: StudyHistory }
  /** No había nada guardado: el tracking todavía no se ha activado. */
  | { status: 'empty' }
  /** Se pudo leer algo, pero parte del historial no era legible. Nada se ha borrado. */
  | { status: 'partial'; history: StudyHistory; damagedMonths: string[] }
  | { status: 'error'; reason: HistoryErrorReason };

export type HistoryErrorReason = 'ilegible';

export function historyErrorMessage(reason: HistoryErrorReason): string {
  return reason === 'ilegible'
    ? 'No se ha podido leer tu historial de estudio. Para no sobrescribirlo, en esta sesión no se registrará actividad nueva.'
    : 'No se ha podido leer tu historial de estudio.';
}

export function damagedHistoryMessage(months: readonly string[]): string {
  const list = months.join(', ');
  return months.length === 1
    ? `Un tramo del historial (${list}) no tiene un formato reconocible. Se ha dejado intacto y no se cuenta en las estadísticas.`
    : `Algunos tramos del historial (${list}) no tienen un formato reconocible. Se han dejado intactos y no se cuentan en las estadísticas.`;
}

/** Lo mínimo que este repositorio necesita de un almacenamiento de clave/valor. */
export type KeyValueStore = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  getAllKeys: () => Promise<readonly string[]>;
};

export function createStudyHistoryRepository(
  storage: KeyValueStore = AsyncStorage,
): StudyHistoryRepository {
  const readMeta = async (): Promise<HistoryMeta | null> =>
    parseMeta(await storage.getItem(HISTORY_META_KEY));

  const readPartition = async (month: string): Promise<HistoryPartition | null> =>
    parsePartition(month, await storage.getItem(monthKey(month)));

  /**
   * Cola de escritura.
   *
   * Cada `append` lee la partición del mes, la mezcla y la vuelve a escribir. Dos de esos
   * ciclos a la vez sobre el mismo mes se pisarían: el segundo leería la versión anterior
   * a que el primero escribiera, y una carta completada desaparecería sin dejar rastro.
   * Encadenarlas garantiza que cada una vea el resultado de la anterior.
   *
   * Se encadena también el caso de fallo (`onRejected`), para que un error puntual no
   * bloquee para siempre todas las escrituras posteriores.
   */
  let queue: Promise<void> = Promise.resolve();
  const enqueue = (task: () => Promise<void>): Promise<void> => {
    queue = queue.then(task, task);
    return queue;
  };

  return {
    flush: () => queue,

    async load(): Promise<HistoryLoadResult> {
      let keys: readonly string[];
      let metaRaw: string | null;
      try {
        [keys, metaRaw] = await Promise.all([
          storage.getAllKeys(),
          storage.getItem(HISTORY_META_KEY),
        ]);
      } catch {
        // El medio falló. No se toca nada de lo que hubiera guardado.
        return { status: 'error', reason: 'ilegible' };
      }

      const months = keys.filter(isMonthKey).map(monthOfKey).sort();
      const meta = parseMeta(metaRaw);

      if (meta === null && metaRaw === null && months.length === 0) {
        return { status: 'empty' };
      }

      const partitions: HistoryPartition[] = [];
      const damagedMonths: string[] = [];
      for (const month of months) {
        let partition: HistoryPartition | null;
        try {
          partition = await readPartition(month);
        } catch {
          partition = null;
        }
        if (partition === null) {
          // Un mes dañado no invalida los demás: se omite, se informa y se deja intacto.
          damagedMonths.push(month);
          continue;
        }
        partitions.push(partition);
      }

      const history = mergeHistory(meta ?? emptyMeta, partitions);
      if (damagedMonths.length > 0) {
        return { status: 'partial', history, damagedMonths };
      }
      return { status: 'ok', history };
    },

    append(patch: HistoryPatch): Promise<void> {
      return enqueue(() => writePatch(patch));
    },
  };

  async function writePatch(patch: HistoryPatch): Promise<void> {
      const sessions = patch.sessions ?? [];
      const cardEvents = patch.cardEvents ?? [];
      const cardAdditions = patch.cardAdditions ?? [];
      const reviews = patch.reviews ?? [];

      // ── Particiones ──────────────────────────────────────────────────────────
      const touched = new Set<string>([
        ...sessions.map(monthOfEntry),
        ...cardEvents.map(monthOfEntry),
        ...cardAdditions.map(monthOfEntry),
        ...reviews.map(monthOfEntry),
      ]);

      for (const month of touched) {
        const current = (await readPartition(month)) ?? emptyPartition(month);
        const next: HistoryPartition = {
          month,
          sessions: upsertById(
            current.sessions,
            sessions.filter((entry) => monthOfEntry(entry) === month),
          ),
          cardEvents: upsertById(
            current.cardEvents,
            cardEvents.filter((entry) => monthOfEntry(entry) === month),
          ),
          cardAdditions: upsertById(
            current.cardAdditions,
            cardAdditions.filter((entry) => monthOfEntry(entry) === month),
          ),
          reviews: upsertById(
            current.reviews,
            reviews.filter((entry) => monthOfEntry(entry) === month),
          ),
        };
        await storage.setItem(monthKey(month), serializePartition(next));
      }
      // ── Metadatos ────────────────────────────────────────────────────────────
      // Después de las particiones a propósito: `ratedSince` marca que existen
      // calificaciones, y escribirlo antes de que lleguen dejaría la pantalla anunciando
      // datos de calificación que todavía no están en disco.
      if (
        patch.trackedSince !== undefined ||
        patch.ratedSince !== undefined ||
        (patch.deckSnapshots !== undefined && patch.deckSnapshots.length > 0)
      ) {
        const current = (await readMeta()) ?? emptyMeta;
        const snapshots = new Map(current.decks.map((deck) => [deck.deckId, deck]));
        for (const snapshot of patch.deckSnapshots ?? []) {
          const previous = snapshots.get(snapshot.deckId);
          // El snapshot solo avanza: un nombre viejo no debe pisar a uno más reciente.
          if (!previous || snapshot.lastSeenAt >= previous.lastSeenAt) {
            snapshots.set(snapshot.deckId, snapshot);
          }
        }
        await storage.setItem(
          HISTORY_META_KEY,
          serializeMeta({
            // El inicio del tracking se fija una sola vez. Moverlo hacia adelante borraría
            // la frontera entre lo que se registró y lo que nunca existió.
            trackedSince: current.trackedSince ?? patch.trackedSince ?? null,
            ratedSince: current.ratedSince ?? patch.ratedSince ?? null,
            decks: [...snapshots.values()],
          }),
        );
      }

  }
}

/**
 * Repositorio sobre un mapa en memoria.
 *
 * Recorre exactamente el mismo camino de serialización que el persistente, así que un test
 * puede desmontar el proveedor, montar otro sobre el mismo repositorio y comprobar que el
 * historial se recupera del medio y no de un estado de React que sobrevivió.
 */
export function createMemoryHistoryRepository(
  initial: Record<string, string> = {},
): StudyHistoryRepository & { peek: () => Record<string, string> } {
  const map = new Map(Object.entries(initial));
  const store: KeyValueStore = {
    getItem: async (key) => map.get(key) ?? null,
    setItem: async (key, value) => {
      map.set(key, value);
    },
    getAllKeys: async () => [...map.keys()],
  };
  return {
    ...createStudyHistoryRepository(store),
    peek: () => Object.fromEntries(map),
  };
}

/** Repositorio que falla siempre al leer, para comprobar que la aplicación no se rompe. */
export function createFailingHistoryRepository(): StudyHistoryRepository {
  return {
    async load(): Promise<HistoryLoadResult> {
      return { status: 'error', reason: 'ilegible' };
    },
    async append(): Promise<void> {
      throw new Error('historial no disponible');
    },
    async flush(): Promise<void> {
      // No hay nada pendiente que esperar: aquí no se escribe nunca.
    },
  };
}

/** Historial vacío listo para usar cuando no hay nada que cargar. */
export const noHistory: StudyHistory = emptyHistory;
