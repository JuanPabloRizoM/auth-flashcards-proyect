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

import { createActiveTimer, type ActiveTimer } from '../features/stats/activeTime';
import { applyHistoryChange, nextHistoryCounter, type HistoryChange } from '../features/stats/history';
import { createPlatformVisibility } from '../features/stats/platformVisibility';
import {
  beginSession,
  completeCard,
  endSession,
  isWorthPersisting,
  revealAnswer,
  showCard,
  type SessionRecording,
} from '../features/stats/recorder';
import { localDayOf } from '../features/stats/time';
import { emptyHistory, type CardOrigin, type StudyHistory } from '../features/stats/types';
import type { Deck } from '../types/domain';

import {
  createStudyHistoryRepository,
  damagedHistoryMessage,
  historyErrorMessage,
  type StudyHistoryRepository,
} from './storage/studyHistoryRepository';

/**
 * Registro del historial de estudio.
 *
 * Es el único que habla con `StudyHistoryRepository`, igual que `LibraryProvider` es el
 * único que habla con `LibraryRepository`. Van separados a propósito: eliminar un mazo
 * vacía la biblioteca de ese mazo y no toca ni un evento del historial, que es exactamente
 * lo confirmado en docs/PRODUCT.md el 2026-08-23.
 *
 * El estado visible y el almacenamiento aplican el mismo cambio a través de
 * `applyHistoryChange`, así que las cifras de la pantalla y las que sobreviven a un
 * recargar no pueden separarse.
 */

export type StudyHistoryStatus = 'loading' | 'ready';

export type StudyHistoryValue = {
  history: StudyHistory;
  status: StudyHistoryStatus;
  /** Problema del almacenamiento del historial, si lo hubo. La aplicación sigue usable. */
  historyError?: string;
  /** Registra el alta de cartas nuevas con su origen. Las anteriores no se tocan. */
  recordCardsAdded: (deckId: string, cardIds: readonly string[], origin: CardOrigin) => void;
  /** Guarda el último nombre conocido de los mazos, para poder nombrarlos si se eliminan. */
  rememberDecks: (decks: readonly Deck[]) => void;
  study: StudyRecorderApi;
};

/**
 * Lo que la pantalla de estudio necesita para registrar lo que pasa.
 *
 * Son funciones imperativas y no estado de React a propósito: registrar no debe provocar
 * un renderizado en mitad de la sesión, y el cronómetro tiene que seguir corriendo aunque
 * el componente se vuelva a pintar.
 */
export type StudyRecorderApi = {
  begin: (deckId: string) => void;
  show: (cardId: string) => void;
  reveal: () => void;
  complete: () => void;
  end: () => void;
};

const StudyHistoryContext = createContext<StudyHistoryValue | null>(null);

export type StudyHistoryProviderProps = {
  children: ReactNode;
  /** Inyectable para probar con otra implementación del mismo contrato. */
  repository?: StudyHistoryRepository;
  /** Inyectable para que los tests puedan fijar instantes concretos. */
  now?: () => number;
};

export function StudyHistoryProvider({
  children,
  repository,
  now = Date.now,
}: StudyHistoryProviderProps) {
  const repositoryRef = useRef<StudyHistoryRepository | null>(repository ?? null);
  if (repositoryRef.current === null) {
    repositoryRef.current = createStudyHistoryRepository();
  }

  const [history, setHistory] = useState<StudyHistory>(emptyHistory);
  const [status, setStatus] = useState<StudyHistoryStatus>('loading');
  const [historyError, setHistoryError] = useState<string | undefined>(undefined);

  /** El historial más reciente, legible desde callbacks sin volver a crearlos. */
  const historyRef = useRef<StudyHistory>(emptyHistory);
  const counter = useRef(0);
  const recording = useRef<SessionRecording | null>(null);
  const timer = useRef<ActiveTimer | null>(null);
  /**
   * Si no se pudo leer el historial puede haber datos válidos debajo. Escribir encima los
   * destruiría, así que se suspende el registro durante esta sesión.
   */
  const writesSuspended = useRef(false);

  useEffect(() => {
    const created = createActiveTimer({ now, visibility: createPlatformVisibility() });
    timer.current = created;
    return () => created.stop();
  }, [now]);

  const nextId = useCallback((prefix: string) => {
    counter.current += 1;
    return `${prefix}-${counter.current}`;
  }, []);

  /** Aplica el cambio al estado visible y lo manda al almacenamiento. */
  const commit = useCallback((change: HistoryChange) => {
    const next = applyHistoryChange(historyRef.current, change);
    historyRef.current = next;
    setHistory(next);

    if (writesSuspended.current) return;
    repositoryRef.current!.append(change).catch(() => {
      setHistoryError('No se ha podido guardar la actividad de estudio en este dispositivo.');
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    const activeRepository = repositoryRef.current!;

    const hydrate = async () => {
      const result = await activeRepository.load();
      if (cancelled) return;

      if (result.status === 'error') {
        writesSuspended.current = true;
        setHistoryError(historyErrorMessage(result.reason));
        setStatus('ready');
        return;
      }

      const loaded = result.status === 'empty' ? emptyHistory : result.history;
      if (result.status === 'partial') {
        setHistoryError(damagedHistoryMessage(result.damagedMonths));
      }

      historyRef.current = loaded;
      counter.current = nextHistoryCounter(loaded);
      setHistory(loaded);
      setStatus('ready');

      // Primera vez que se abre la aplicación con tracking: aquí empieza el historial
      // fiable. No se fabrica nada anterior; lo que ya existiera es baseline sin fecha
      // (docs/PRODUCT.md, 2026-08-23).
      if (loaded.trackedSince === null) {
        const startedAt = now();
        const next = applyHistoryChange(loaded, { trackedSince: startedAt });
        historyRef.current = next;
        setHistory(next);
        if (!writesSuspended.current) {
          activeRepository.append({ trackedSince: startedAt }).catch(() => undefined);
        }
      }
    };

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [now]);

  const recordCardsAdded = useCallback(
    (deckId: string, cardIds: readonly string[], origin: CardOrigin) => {
      if (cardIds.length === 0) return;
      const addedAt = now();
      const localDay = localDayOf(addedAt);
      commit({
        cardAdditions: cardIds.map((cardId) => ({
          id: nextId('alta'),
          deckId,
          cardId,
          addedAt,
          origin,
          localDay,
        })),
      });
    },
    [commit, nextId, now],
  );

  const rememberDecks = useCallback(
    (decks: readonly Deck[]) => {
      if (decks.length === 0) return;
      const lastSeenAt = now();
      const known = new Map(historyRef.current.deckSnapshots.map((s) => [s.deckId, s.name]));
      // Solo se escribe cuando algún nombre cambió de verdad: renombrar un mazo actualiza
      // el snapshot, y abrir la aplicación no reescribe los metadatos sin motivo.
      const changed = decks.filter((deck) => known.get(deck.id) !== deck.name);
      if (changed.length === 0) return;
      commit({
        deckSnapshots: changed.map((deck) => ({
          deckId: deck.id,
          name: deck.name,
          lastSeenAt,
        })),
      });
    },
    [commit, now],
  );

  const study = useMemo<StudyRecorderApi>(
    () => ({
      begin: (deckId) => {
        const at = now();
        recording.current = beginSession({ sessionId: nextId('sesion'), deckId, at });
        timer.current?.reset();
      },
      show: (cardId) => {
        if (!recording.current) return;
        recording.current = showCard(recording.current, {
          eventId: nextId('evento'),
          cardId,
          at: now(),
        });
        // El cronómetro se reinicia por carta: cada evento lleva su propio tiempo activo.
        timer.current?.reset();
      },
      reveal: () => {
        if (!recording.current) return;
        recording.current = revealAnswer(recording.current, now());
      },
      complete: () => {
        const current = recording.current;
        if (!current || !current.pending) return;
        const next = completeCard(current, {
          at: now(),
          activeMs: timer.current?.elapsed() ?? 0,
        });
        recording.current = next;
        const event = next.events[next.events.length - 1];
        // Se persiste carta a carta: si la persona usuaria recarga a mitad de la sesión,
        // lo que ya estudió no se pierde.
        commit({ sessions: [next.session], cardEvents: event ? [event] : [] });
      },
      end: () => {
        const current = recording.current;
        recording.current = null;
        if (!current) return;
        const finished = endSession(current, now());
        // Una sesión sin ninguna carta completada no aporta nada y no se guarda.
        if (isWorthPersisting(finished)) {
          commit({ sessions: [finished.session] });
        }
      },
    }),
    [commit, nextId, now],
  );

  const value = useMemo<StudyHistoryValue>(
    () => ({ history, status, historyError, recordCardsAdded, rememberDecks, study }),
    [history, historyError, recordCardsAdded, rememberDecks, status, study],
  );

  return (
    <StudyHistoryContext.Provider value={value}>{children}</StudyHistoryContext.Provider>
  );
}

export function useStudyHistory(): StudyHistoryValue {
  const value = useContext(StudyHistoryContext);
  if (!value) {
    throw new Error('useStudyHistory debe usarse dentro de StudyHistoryProvider.');
  }
  return value;
}
