import { localDayOf, localHourOf } from './time';
import type { StudyCardEvent, StudySession } from './types';

/**
 * Registro de una sesión de estudio.
 *
 * Máquina de estados pura: recibe el estado y un instante, y devuelve el estado siguiente.
 * No lee el reloj ni escribe en el almacenamiento, así que un test puede reproducir una
 * sesión entera con instantes elegidos y afirmar sobre duraciones exactas.
 *
 * Lo que se conserva son eventos, no contadores: `completedCards` y `activeMs` de la sesión
 * se derivan de sus cartas completadas y nunca se editan por su cuenta, de modo que sesión
 * y eventos no puedan discrepar al recalcular estadísticas más adelante.
 */

export type SessionRecording = {
  session: StudySession;
  /** Cartas ya completadas, en orden. */
  events: StudyCardEvent[];
  /** La carta que está a la vista ahora mismo, todavía sin completar. */
  pending: StudyCardEvent | null;
};

export type BeginSessionInput = { sessionId: string; deckId: string; at: number };

export function beginSession({ sessionId, deckId, at }: BeginSessionInput): SessionRecording {
  return {
    session: {
      id: sessionId,
      deckId,
      startedAt: at,
      endedAt: null,
      activeMs: 0,
      completedCards: 0,
      localDay: localDayOf(at),
    },
    events: [],
    pending: null,
  };
}

export type ShowCardInput = { eventId: string; cardId: string; at: number };

/**
 * Empieza a mostrar una carta.
 *
 * Si había otra a la vista sin completar, se descarta: la persona usuaria salió sin pasar
 * a la siguiente y esa carta no se estudió. Contarla inflaría tanto las tarjetas como el
 * tiempo con una lectura que nunca terminó.
 */
export function showCard(
  recording: SessionRecording,
  { eventId, cardId, at }: ShowCardInput,
): SessionRecording {
  return {
    ...recording,
    pending: {
      id: eventId,
      sessionId: recording.session.id,
      deckId: recording.session.deckId,
      cardId,
      shownAt: at,
      revealedAt: null,
      completedAt: null,
      activeMs: 0,
      localDay: localDayOf(at),
      localHour: localHourOf(at),
    },
  };
}

/** Marca el momento de revelar el reverso. Idempotente: solo cuenta la primera vez. */
export function revealAnswer(recording: SessionRecording, at: number): SessionRecording {
  const { pending } = recording;
  if (!pending || pending.revealedAt !== null) {
    return recording;
  }
  return { ...recording, pending: { ...pending, revealedAt: at } };
}

export type CompleteCardInput = { at: number; activeMs: number };

/**
 * Cierra la carta a la vista y la suma a la sesión.
 *
 * `activeMs` lo aporta quien llama, que es quien sabe cuánto de ese rato la aplicación
 * estuvo de verdad delante (ver `activeTime.ts`). El día y la hora locales se congelan
 * aquí, en el instante en que se completó, y ya no vuelven a calcularse.
 */
export function completeCard(
  recording: SessionRecording,
  { at, activeMs }: CompleteCardInput,
): SessionRecording {
  const { pending } = recording;
  if (!pending) {
    return recording;
  }

  const safeActiveMs = Math.max(0, Math.round(activeMs));
  const completed: StudyCardEvent = {
    ...pending,
    completedAt: at,
    activeMs: safeActiveMs,
    localDay: localDayOf(at),
    localHour: localHourOf(at),
  };

  return {
    session: {
      ...recording.session,
      activeMs: recording.session.activeMs + safeActiveMs,
      completedCards: recording.session.completedCards + 1,
    },
    events: [...recording.events, completed],
    pending: null,
  };
}

/** Cierra la sesión. La carta que quedara a la vista sin completar se descarta. */
export function endSession(recording: SessionRecording, at: number): SessionRecording {
  if (recording.session.endedAt !== null) {
    return recording;
  }
  return {
    ...recording,
    session: { ...recording.session, endedAt: at },
    pending: null,
  };
}

/** ¿Merece la pena guardar esta sesión? Una sesión sin cartas completadas no aporta nada. */
export function isWorthPersisting(recording: SessionRecording): boolean {
  return recording.events.length > 0;
}
