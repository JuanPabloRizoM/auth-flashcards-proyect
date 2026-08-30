import { newScheduling, type CardScheduling, type ReviewRating, type SchedulingState } from '../../../src/features/scheduler/types';
import type {
  CardAddedEvent,
  CardOrigin,
  DeckSnapshot,
  StudyCardEvent,
  StudyHistory,
  StudyReviewEvent,
  StudySession,
} from '../../../src/features/stats/types';
import type { Card, Deck, Library } from '../../../src/types/domain';

/**
 * Constructores de datasets para los tests de estadísticas.
 *
 * Todo se declara con el día y la hora locales ya fijados, que es exactamente como el
 * historial los guarda. Así un test puede afirmar sobre resultados calculables a mano sin
 * depender de la zona horaria en la que se ejecute.
 */

let sequence = 0;
export function resetSequence(): void {
  sequence = 0;
}

function nextId(prefix: string): string {
  sequence += 1;
  return `${prefix}-${sequence}`;
}

/** Instante arbitrario pero estable dentro de un día, para los campos de timestamp. */
function instantOf(day: string, hour: number): number {
  return Date.parse(`${day}T${String(hour).padStart(2, '0')}:00:00Z`);
}

export type EventoOptions = {
  deckId: string;
  day: string;
  cardId?: string;
  sessionId?: string;
  hour?: number;
  /** Duración activa en milisegundos. Por defecto 30 s, para que las cuentas sean redondas. */
  activeMs?: number;
  /** Un evento sin completar: se mostró pero se abandonó. No cuenta como estudiada. */
  incompleto?: boolean;
};

export function evento({
  deckId,
  day,
  cardId = nextId('carta'),
  sessionId = `sesion-${deckId}-${day}`,
  hour = 10,
  activeMs = 30_000,
  incompleto = false,
}: EventoOptions): StudyCardEvent {
  const at = instantOf(day, hour);
  return {
    id: nextId('evento'),
    sessionId,
    deckId,
    cardId,
    shownAt: at,
    revealedAt: incompleto ? null : at + 5_000,
    completedAt: incompleto ? null : at + activeMs,
    activeMs: incompleto ? 0 : activeMs,
    localDay: day,
    localHour: hour,
  };
}

/** `cantidad` eventos idénticos salvo por la carta. Para armar días con volumen. */
export function eventos(cantidad: number, options: EventoOptions): StudyCardEvent[] {
  return Array.from({ length: cantidad }, () => evento({ ...options, cardId: nextId('carta') }));
}

export type SesionOptions = {
  deckId: string;
  day: string;
  id?: string;
  activeMs?: number;
  completedCards?: number;
  /** Sesión todavía abierta: no cuenta para la media ni para la más larga. */
  abierta?: boolean;
};

export function sesion({
  deckId,
  day,
  id = `sesion-${deckId}-${day}`,
  activeMs = 300_000,
  completedCards = 10,
  abierta = false,
}: SesionOptions): StudySession {
  const startedAt = instantOf(day, 10);
  return {
    id,
    deckId,
    startedAt,
    endedAt: abierta ? null : startedAt + activeMs,
    activeMs,
    completedCards,
    localDay: day,
  };
}

export type AltaOptions = {
  deckId: string;
  cardId: string;
  day: string;
  origin?: CardOrigin;
};

export function alta({ deckId, cardId, day, origin = 'manual' }: AltaOptions): CardAddedEvent {
  return {
    id: nextId('alta'),
    deckId,
    cardId,
    addedAt: instantOf(day, 9),
    origin,
    localDay: day,
  };
}

export function snapshot(deckId: string, name: string, day = '2026-08-01'): DeckSnapshot {
  return { deckId, name, lastSeenAt: instantOf(day, 12) };
}

export type RevisionOptions = {
  deckId: string;
  cardId: string;
  day: string;
  rating?: ReviewRating;
  hour?: number;
  /** Estado en el que estaba la carta al aparecer. Decide Young/Mature y si cuenta. */
  previousState?: SchedulingState;
  /** Intervalo que la carta tenía al aparecer. Menos de 21 días es Young. */
  previousIntervalDays?: number;
  newIntervalDays?: number;
  id?: string;
  sessionId?: string;
};

export function revision({
  deckId,
  cardId,
  day,
  rating = 'bien',
  hour = 10,
  previousState = 'repaso',
  previousIntervalDays = 5,
  newIntervalDays = 12,
  id,
  sessionId = `sesion-${deckId}-${day}`,
}: RevisionOptions): StudyReviewEvent {
  const at = instantOf(day, hour);
  return {
    id: id ?? nextId('review'),
    sessionId,
    deckId,
    cardId,
    reviewedAt: at,
    rating,
    previousState,
    newState: rating === 'otra-vez' ? 'reaprendiendo' : 'repaso',
    previousDue: at - previousIntervalDays * 86_400_000,
    newDue: at + newIntervalDays * 86_400_000,
    previousIntervalDays,
    newIntervalDays,
    elapsedDays: previousIntervalDays,
    stability: 12.5,
    difficulty: 5,
    durationMs: 8_000,
    schedulerId: 'fsrs',
    schedulerVersion: 'ts-fsrs v5.4.1 using FSRS-6.0',
    localDay: day,
    localHour: hour,
  };
}

/** `cantidad` revisiones idénticas salvo por la carta. Para armar volumen. */
export function revisiones(cantidad: number, options: RevisionOptions): StudyReviewEvent[] {
  return Array.from({ length: cantidad }, () =>
    revision({ ...options, cardId: options.cardId || nextId('carta') }),
  );
}

export function historial(partes: Partial<StudyHistory> = {}): StudyHistory {
  return {
    // `null` explícito significa "todavía sin tracking" y debe respetarse: es justo el caso
    // que hay que poder probar. Por eso no se usa `??`, que lo trataría como "no indicado".
    trackedSince: 'trackedSince' in partes ? partes.trackedSince! : instantOf('2026-08-01', 8),
    ratedSince: 'ratedSince' in partes ? partes.ratedSince! : null,
    sessions: partes.sessions ?? [],
    cardEvents: partes.cardEvents ?? [],
    cardAdditions: partes.cardAdditions ?? [],
    reviews: partes.reviews ?? [],
    deckSnapshots: partes.deckSnapshots ?? [],
  };
}

export function mazo(id: string, name: string): Deck {
  return { id, name, updatedAt: '2026-08-01T12:00:00.000Z' };
}

/** Estado de scheduling arbitrario, para armar bibliotecas con inventario conocido. */
export function programacion(partes: Partial<CardScheduling> = {}): CardScheduling {
  return { ...newScheduling, ...partes };
}

/** Carta en repaso con un intervalo dado. `due` se sitúa a `enDias` días de `desde`. */
export function cartaEnRepaso(
  id: string,
  deckId: string,
  options: { intervalo: number; enDias: number; desde: number; stability?: number; difficulty?: number },
): Card {
  return {
    ...carta(id, deckId),
    scheduling: programacion({
      state: 'repaso',
      due: options.desde + options.enDias * 86_400_000,
      lastReview: options.desde - options.intervalo * 86_400_000,
      stability: options.stability ?? options.intervalo * 1.2,
      difficulty: options.difficulty ?? 5,
      elapsedDays: options.intervalo,
      scheduledDays: options.intervalo,
      reps: 3,
      lapses: 0,
    }),
  };
}

export function carta(id: string, deckId: string, scheduling: CardScheduling = { ...newScheduling }): Card {
  return { id, deckId, front: `frente ${id}`, back: `reverso ${id}`, scheduling };
}

export function biblioteca(decks: readonly Deck[] = [], cards: readonly Card[] = []): Library {
  return { decks: [...decks], cards: [...cards], scheduler: null };
}
