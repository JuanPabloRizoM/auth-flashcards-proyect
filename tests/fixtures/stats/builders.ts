import type {
  CardAddedEvent,
  CardOrigin,
  DeckSnapshot,
  StudyCardEvent,
  StudyHistory,
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

export function historial(partes: Partial<StudyHistory> = {}): StudyHistory {
  return {
    // `null` explícito significa "todavía sin tracking" y debe respetarse: es justo el caso
    // que hay que poder probar. Por eso no se usa `??`, que lo trataría como "no indicado".
    trackedSince: 'trackedSince' in partes ? partes.trackedSince! : instantOf('2026-08-01', 8),
    sessions: partes.sessions ?? [],
    cardEvents: partes.cardEvents ?? [],
    cardAdditions: partes.cardAdditions ?? [],
    deckSnapshots: partes.deckSnapshots ?? [],
  };
}

export function mazo(id: string, name: string): Deck {
  return { id, name, updatedAt: '2026-08-01T12:00:00.000Z' };
}

export function carta(id: string, deckId: string): Card {
  return { id, deckId, front: `frente ${id}`, back: `reverso ${id}` };
}

export function biblioteca(decks: readonly Deck[] = [], cards: readonly Card[] = []): Library {
  return { decks: [...decks], cards: [...cards] };
}
