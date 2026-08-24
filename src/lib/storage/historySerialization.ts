import { isValidDay, monthOfDay } from '../../features/stats/time';
import type {
  CardAddedEvent,
  DeckSnapshot,
  StudyCardEvent,
  StudyHistory,
  StudySession,
} from '../../features/stats/types';
import { cardOrigins } from '../../features/stats/types';

/**
 * Serialización del historial de estudio.
 *
 * Formato persistido, versión 1. El historial NO vive en un único documento que se
 * reescriba entero en cada carta completada: se reparte en un documento de metadatos y un
 * documento por mes natural.
 *
 * ```text
 * flashcards:history:v1:meta          { "version": 1, "trackedSince": 1766…, "decks": [...] }
 * flashcards:history:v1:month:2026-08 { "version": 1, "month": "2026-08",
 *                                       "sessions": [...], "cardEvents": [...],
 *                                       "cardAdditions": [...] }
 * ```
 *
 * **Estrategia de crecimiento.** Completar una carta reescribe solo la partición del mes
 * en curso, así que el coste de escribir depende de la actividad de ese mes y no de todo
 * el historial acumulado. Los meses cerrados no se vuelven a tocar nunca.
 *
 * **Descubrimiento.** Las particiones existentes se encuentran recorriendo las claves del
 * almacenamiento, no un índice guardado en los metadatos: un índice desincronizado dejaría
 * invisible un mes entero de historial que sigue estando ahí.
 *
 * **Recuperación ante datos inválidos.** Cada documento se valida por separado. Una
 * partición ilegible se omite y se informa, y las demás siguen cargándose: un mes dañado
 * no se lleva por delante el resto del historial. Nada se borra.
 *
 * **Migración.** Solo existe la versión 1. Cuando haya una 2, esta función seguirá leyendo
 * la 1 y migrándola al vuelo, como hace `serialization.ts` con la biblioteca: subir la
 * versión sin migrar marcaría como inválido el historial de quien ya estuviera usando la
 * aplicación.
 */
export const HISTORY_VERSION = 1;

export const HISTORY_META_KEY = 'flashcards:history:v1:meta';
export const HISTORY_MONTH_PREFIX = 'flashcards:history:v1:month:';

export function monthKey(month: string): string {
  return `${HISTORY_MONTH_PREFIX}${month}`;
}

/** ¿Es esta clave del almacenamiento una partición mensual del historial? */
export function isMonthKey(key: string): boolean {
  return key.startsWith(HISTORY_MONTH_PREFIX) && /^\d{4}-\d{2}$/.test(monthOfKey(key));
}

export function monthOfKey(key: string): string {
  return key.slice(HISTORY_MONTH_PREFIX.length);
}

/** Metadatos: cuándo empezó el tracking y el último nombre conocido de cada mazo. */
export type HistoryMeta = {
  trackedSince: number | null;
  decks: DeckSnapshot[];
};

export const emptyMeta: HistoryMeta = { trackedSince: null, decks: [] };

/** Contenido de un mes. */
export type HistoryPartition = {
  month: string;
  sessions: StudySession[];
  cardEvents: StudyCardEvent[];
  cardAdditions: CardAddedEvent[];
};

export function emptyPartition(month: string): HistoryPartition {
  return { month, sessions: [], cardEvents: [], cardAdditions: [] };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || isFiniteNumber(value);
}

function isDay(value: unknown): value is string {
  return typeof value === 'string' && isValidDay(value);
}

function isSession(value: unknown): value is StudySession {
  if (!isObject(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.deckId === 'string' &&
    isFiniteNumber(value.startedAt) &&
    isNullableNumber(value.endedAt) &&
    isFiniteNumber(value.activeMs) &&
    isFiniteNumber(value.completedCards) &&
    isDay(value.localDay)
  );
}

function isCardEvent(value: unknown): value is StudyCardEvent {
  if (!isObject(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.sessionId === 'string' &&
    typeof value.deckId === 'string' &&
    typeof value.cardId === 'string' &&
    isFiniteNumber(value.shownAt) &&
    isNullableNumber(value.revealedAt) &&
    isNullableNumber(value.completedAt) &&
    isFiniteNumber(value.activeMs) &&
    isDay(value.localDay) &&
    isFiniteNumber(value.localHour) &&
    value.localHour >= 0 &&
    value.localHour < 24
  );
}

function isCardAddition(value: unknown): value is CardAddedEvent {
  if (!isObject(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.deckId === 'string' &&
    typeof value.cardId === 'string' &&
    isFiniteNumber(value.addedAt) &&
    typeof value.origin === 'string' &&
    (cardOrigins as readonly string[]).includes(value.origin) &&
    isDay(value.localDay)
  );
}

function isDeckSnapshot(value: unknown): value is DeckSnapshot {
  if (!isObject(value)) return false;
  return (
    typeof value.deckId === 'string' &&
    typeof value.name === 'string' &&
    isFiniteNumber(value.lastSeenAt)
  );
}

export function serializeMeta(meta: HistoryMeta): string {
  return JSON.stringify({
    version: HISTORY_VERSION,
    trackedSince: meta.trackedSince,
    decks: meta.decks,
  });
}

export function serializePartition(partition: HistoryPartition): string {
  return JSON.stringify({
    version: HISTORY_VERSION,
    month: partition.month,
    sessions: partition.sessions,
    cardEvents: partition.cardEvents,
    cardAdditions: partition.cardAdditions,
  });
}

function parseDocument(raw: string | null): Record<string, unknown> | null {
  if (raw === null || raw === '') return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isObject(parsed) || parsed.version !== HISTORY_VERSION) return null;
  return parsed;
}

/** `null` significa "no hay nada legible aquí". Quien llama decide si es vacío o inválido. */
export function parseMeta(raw: string | null): HistoryMeta | null {
  const document = parseDocument(raw);
  if (!document) return null;
  if (!isNullableNumber(document.trackedSince)) return null;
  if (!Array.isArray(document.decks) || !document.decks.every(isDeckSnapshot)) return null;
  return { trackedSince: document.trackedSince, decks: document.decks as DeckSnapshot[] };
}

export function parsePartition(month: string, raw: string | null): HistoryPartition | null {
  const document = parseDocument(raw);
  if (!document) return null;
  const { sessions, cardEvents, cardAdditions } = document;
  if (!Array.isArray(sessions) || !sessions.every(isSession)) return null;
  if (!Array.isArray(cardEvents) || !cardEvents.every(isCardEvent)) return null;
  if (!Array.isArray(cardAdditions) || !cardAdditions.every(isCardAddition)) return null;
  return {
    month,
    sessions: sessions as StudySession[],
    cardEvents: cardEvents as StudyCardEvent[],
    cardAdditions: cardAdditions as CardAddedEvent[],
  };
}

/** Reúne metadatos y particiones en el historial que consume el motor. */
export function mergeHistory(
  meta: HistoryMeta,
  partitions: readonly HistoryPartition[],
): StudyHistory {
  const ordered = [...partitions].sort((a, b) => a.month.localeCompare(b.month));
  return {
    trackedSince: meta.trackedSince,
    deckSnapshots: meta.decks,
    sessions: ordered.flatMap((partition) => partition.sessions),
    cardEvents: ordered.flatMap((partition) => partition.cardEvents),
    cardAdditions: ordered.flatMap((partition) => partition.cardAdditions),
  };
}

/** Reemplaza por id, o añade si es nuevo. Mantiene el historial append-only sin duplicar. */
export function upsertById<T extends { id: string }>(existing: T[], incoming: readonly T[]): T[] {
  if (incoming.length === 0) return existing;
  const byId = new Map(existing.map((entry) => [entry.id, entry]));
  for (const entry of incoming) {
    byId.set(entry.id, entry);
  }
  return [...byId.values()];
}

/** El mes al que pertenece cualquier registro del historial. */
export function monthOfEntry(entry: { localDay: string }): string {
  return monthOfDay(entry.localDay);
}
