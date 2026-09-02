import { reviewRatings, schedulingStates } from '../../features/scheduler/types';
import { isValidDay, monthOfDay } from '../../features/stats/time';
import type {
  CardAddedEvent,
  DeckSnapshot,
  StudyCardEvent,
  StudyHistory,
  StudyReviewEvent,
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
 * <PREFIJO>:meta          { "version": 2, "trackedSince": 1766…, "ratedSince": 1787…,
 *                           "decks": [...] }
 * <PREFIJO>:month:2026-08 { "version": 2, "month": "2026-08",
 *                           "sessions": [...], "cardEvents": [...],
 *                           "cardAdditions": [...], "reviews": [...] }
 * ```
 *
 * Desde TASK-008 el prefijo es el del usuario autenticado (`src/lib/storage/keys.ts`), y no
 * una constante: dos cuentas en el mismo dispositivo no pueden compartir bitácora. El
 * prefijo anterior a las cuentas se conserva como `LEGACY_HISTORY_PREFIX`, y solo se lee
 * para migrarlo.
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
 * **Migración.** La versión 1 es la de TASK-006: sin calificaciones. La versión 2, de
 * TASK-007, añade `reviews` a cada partición y `ratedSince` a los metadatos. La 1 se sigue
 * leyendo y se migra al vuelo con `reviews` vacío y `ratedSince` nulo, como hace
 * `serialization.ts` con la biblioteca: subir la versión sin migrar marcaría como inválido
 * el historial de quien ya estuviera usando la aplicación.
 *
 * La migración **no fabrica calificaciones**. Los eventos de TASK-006 registran que una
 * carta se estudió, no cómo salió; convertirlos en aciertos o en fallos sería inventarse el
 * dato (docs/PRODUCT.md, 2026-08-30).
 *
 * La clave conserva el sufijo `v1` con el que nació, igual que la de la biblioteca: la
 * versión vive dentro del documento, que es donde puede migrarse.
 */
export const HISTORY_VERSION = 2;

/** Versiones que esta build sabe leer. Escribir, escribe siempre la actual. */
const READABLE_HISTORY_VERSIONS = [1, HISTORY_VERSION];

/**
 * Las claves concretas de un espacio de nombres.
 *
 * Se construyen a partir del prefijo en vez de ser constantes del módulo porque el prefijo
 * depende de quién ha iniciado sesión. Agruparlas evita que el repositorio y los tests
 * vuelvan a componer la misma cadena por su cuenta y acaben discrepando en un separador.
 */
export type HistoryKeys = {
  readonly prefix: string;
  readonly meta: string;
  readonly monthPrefix: string;
  month: (month: string) => string;
  isMonth: (key: string) => boolean;
  monthOf: (key: string) => string;
};

export function historyKeys(prefix: string): HistoryKeys {
  const monthPrefix = `${prefix}:month:`;
  const monthOf = (key: string): string => key.slice(monthPrefix.length);

  return {
    prefix,
    meta: `${prefix}:meta`,
    monthPrefix,
    month: (month) => `${monthPrefix}${month}`,
    isMonth: (key) => key.startsWith(monthPrefix) && /^\d{4}-\d{2}$/.test(monthOf(key)),
    monthOf,
  };
}

/** Metadatos: cuándo empezó el tracking y el último nombre conocido de cada mazo. */
export type HistoryMeta = {
  trackedSince: number | null;
  /** Cuándo se registró la primera calificación. `null` si todavía no hay ninguna. */
  ratedSince: number | null;
  decks: DeckSnapshot[];
};

export const emptyMeta: HistoryMeta = { trackedSince: null, ratedSince: null, decks: [] };

/** Contenido de un mes. */
export type HistoryPartition = {
  month: string;
  sessions: StudySession[];
  cardEvents: StudyCardEvent[];
  cardAdditions: CardAddedEvent[];
  reviews: StudyReviewEvent[];
};

export function emptyPartition(month: string): HistoryPartition {
  return { month, sessions: [], cardEvents: [], cardAdditions: [], reviews: [] };
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

function isReview(value: unknown): value is StudyReviewEvent {
  if (!isObject(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.sessionId === 'string' &&
    typeof value.deckId === 'string' &&
    typeof value.cardId === 'string' &&
    isFiniteNumber(value.reviewedAt) &&
    typeof value.rating === 'string' &&
    (reviewRatings as readonly string[]).includes(value.rating) &&
    typeof value.previousState === 'string' &&
    (schedulingStates as readonly string[]).includes(value.previousState) &&
    typeof value.newState === 'string' &&
    (schedulingStates as readonly string[]).includes(value.newState) &&
    isNullableNumber(value.previousDue) &&
    isFiniteNumber(value.newDue) &&
    isFiniteNumber(value.previousIntervalDays) &&
    isFiniteNumber(value.newIntervalDays) &&
    isFiniteNumber(value.elapsedDays) &&
    isFiniteNumber(value.stability) &&
    isFiniteNumber(value.difficulty) &&
    isFiniteNumber(value.durationMs) &&
    typeof value.schedulerId === 'string' &&
    typeof value.schedulerVersion === 'string' &&
    isDay(value.localDay) &&
    isFiniteNumber(value.localHour) &&
    value.localHour >= 0 &&
    value.localHour < 24
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
    ratedSince: meta.ratedSince,
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
    reviews: partition.reviews,
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
  if (!isObject(parsed)) return null;
  if (typeof parsed.version !== 'number' || !READABLE_HISTORY_VERSIONS.includes(parsed.version)) {
    return null;
  }
  return parsed;
}

/** `null` significa "no hay nada legible aquí". Quien llama decide si es vacío o inválido. */
export function parseMeta(raw: string | null): HistoryMeta | null {
  const document = parseDocument(raw);
  if (!document) return null;
  if (!isNullableNumber(document.trackedSince)) return null;
  if (!Array.isArray(document.decks) || !document.decks.every(isDeckSnapshot)) return null;
  // La versión 1 no conocía `ratedSince`: se lee como "todavía no se ha calificado nada".
  const ratedSince = document.ratedSince ?? null;
  if (!isNullableNumber(ratedSince)) return null;
  return {
    trackedSince: document.trackedSince,
    ratedSince,
    decks: document.decks as DeckSnapshot[],
  };
}

export function parsePartition(month: string, raw: string | null): HistoryPartition | null {
  const document = parseDocument(raw);
  if (!document) return null;
  const { sessions, cardEvents, cardAdditions } = document;
  if (!Array.isArray(sessions) || !sessions.every(isSession)) return null;
  if (!Array.isArray(cardEvents) || !cardEvents.every(isCardEvent)) return null;
  if (!Array.isArray(cardAdditions) || !cardAdditions.every(isCardAddition)) return null;
  // Una partición de la versión 1 no tiene `reviews`, y no se le inventa ninguna.
  const reviews = document.reviews ?? [];
  if (!Array.isArray(reviews) || !reviews.every(isReview)) return null;
  return {
    month,
    sessions: sessions as StudySession[],
    cardEvents: cardEvents as StudyCardEvent[],
    cardAdditions: cardAdditions as CardAddedEvent[],
    reviews: reviews as StudyReviewEvent[],
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
    ratedSince: meta.ratedSince,
    deckSnapshots: meta.decks,
    sessions: ordered.flatMap((partition) => partition.sessions),
    cardEvents: ordered.flatMap((partition) => partition.cardEvents),
    cardAdditions: ordered.flatMap((partition) => partition.cardAdditions),
    reviews: ordered.flatMap((partition) => partition.reviews),
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
