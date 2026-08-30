import { newScheduling, schedulingStates } from '../../features/scheduler/types';
import type { CardScheduling, SchedulerParameters } from '../../features/scheduler/types';
import type { Card, Deck, Library, SchedulerMetadata } from '../../types/domain';

import type { LoadResult } from './types';

/**
 * Serialización del almacenamiento local.
 *
 * Forma persistida, deliberadamente simple: un único documento JSON.
 *
 * ```json
 * { "version": 3,
 *   "decks": [{ "id": "...", "name": "...", "updatedAt": "..." }],
 *   "cards": [{ "id": "...", "deckId": "...", "front": "...", "back": "...",
 *               "scheduling": { "state": "nueva", "due": null, ... } }],
 *   "scheduler": { "id": "fsrs", "version": "…", "parameters": { ... } } }
 * ```
 *
 * Un solo documento evita escrituras parciales que dejarían cartas sin su mazo, o cartas
 * sin su programación.
 *
 * ## Versiones
 *
 * - **1** (TASK-004): mazos sin `updatedAt`, cartas sin `scheduling`.
 * - **2** (TASK-005): mazos con `updatedAt`.
 * - **3** (TASK-007): cartas con `scheduling`, y metadata del scheduler en el documento.
 *
 * Las tres se leen. Escribir, se escribe siempre la actual. La clave del almacenamiento
 * sigue siendo `flashcards:library:v1`: la versión vive dentro del documento, que es donde
 * puede migrarse. Cambiar la clave dejaría huérfana la biblioteca de quien ya estuviera
 * usando la aplicación.
 *
 * ## Migración a la versión 3
 *
 * Cada carta anterior recibe el estado `nueva`, que es exactamente lo confirmado en
 * docs/PRODUCT.md el 2026-08-30: la carta conserva su id, su mazo, su frente y su reverso,
 * y para el scheduler empieza de cero. **No se le fabrica ninguna revisión, ninguna
 * calificación ni ninguna fecha de vencimiento**: reconstruir un historial FSRS que nunca
 * existió produciría estadísticas falsas. El historial de estudio de TASK-006 no se toca:
 * vive en otro almacén y sobrevive intacto.
 */
export const STORAGE_VERSION = 3;

/** Versiones que esta build sabe leer. Escribir, escribe siempre la actual. */
const READABLE_VERSIONS = [1, 2, STORAGE_VERSION];

export function serializeLibrary(library: Library): string {
  return JSON.stringify({
    version: STORAGE_VERSION,
    decks: library.decks,
    cards: library.cards,
    scheduler: library.scheduler,
  });
}

/** Mazo de la versión 1: sin `updatedAt`. */
function isDeckV1(value: unknown): value is Omit<Deck, 'updatedAt'> {
  if (typeof value !== 'object' || value === null) return false;
  const deck = value as Record<string, unknown>;
  return typeof deck.id === 'string' && typeof deck.name === 'string';
}

function isDeckV2(value: unknown): value is Deck {
  return isDeckV1(value) && typeof (value as Record<string, unknown>).updatedAt === 'string';
}

/** Carta de las versiones 1 y 2: sin `scheduling`. */
function isCardV2(value: unknown): value is Omit<Card, 'scheduling'> {
  if (typeof value !== 'object' || value === null) return false;
  const card = value as Record<string, unknown>;
  return (
    typeof card.id === 'string' &&
    typeof card.deckId === 'string' &&
    typeof card.front === 'string' &&
    typeof card.back === 'string'
  );
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || isFiniteNumber(value);
}

function isScheduling(value: unknown): value is CardScheduling {
  if (typeof value !== 'object' || value === null) return false;
  const s = value as Record<string, unknown>;
  return (
    typeof s.state === 'string' &&
    (schedulingStates as readonly string[]).includes(s.state) &&
    isNullableNumber(s.due) &&
    isNullableNumber(s.lastReview) &&
    isFiniteNumber(s.stability) &&
    isFiniteNumber(s.difficulty) &&
    isFiniteNumber(s.elapsedDays) &&
    isFiniteNumber(s.scheduledDays) &&
    isFiniteNumber(s.learningSteps) &&
    isFiniteNumber(s.reps) &&
    isFiniteNumber(s.lapses)
  );
}

function isCardV3(value: unknown): value is Card {
  return isCardV2(value) && isScheduling((value as Record<string, unknown>).scheduling);
}

function isParameters(value: unknown): value is SchedulerParameters {
  if (typeof value !== 'object' || value === null) return false;
  const p = value as Record<string, unknown>;
  const isStringArray = (v: unknown) => Array.isArray(v) && v.every((e) => typeof e === 'string');
  return (
    isFiniteNumber(p.requestRetention) &&
    isFiniteNumber(p.maximumIntervalDays) &&
    isStringArray(p.learningSteps) &&
    isStringArray(p.relearningSteps) &&
    typeof p.enableFuzz === 'boolean' &&
    typeof p.enableShortTerm === 'boolean' &&
    Array.isArray(p.weights) &&
    p.weights.every(isFiniteNumber)
  );
}

function isSchedulerMetadata(value: unknown): value is SchedulerMetadata {
  if (typeof value !== 'object' || value === null) return false;
  const m = value as Record<string, unknown>;
  return typeof m.id === 'string' && typeof m.version === 'string' && isParameters(m.parameters);
}

/**
 * Convierte lo leído del almacenamiento en un resultado utilizable.
 *
 * `null` significa que no había nada guardado, que no es un error.
 * Cualquier otra cosa que no encaje se reporta como contenido inválido: no se descarta
 * el original, solo se deja de usar hasta que la persona usuaria escriba encima.
 *
 * `now` es la marca que reciben los mazos migrados desde la versión 1, que no guardaba
 * ninguna fecha. Se inyecta para que los tests puedan afirmar sobre un valor concreto en
 * vez de sobre "más o menos ahora".
 */
export function parseStoredLibrary(
  raw: string | null,
  now: string = new Date().toISOString(),
): LoadResult {
  if (raw === null || raw === '') {
    return { status: 'empty' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { status: 'error', reason: 'contenido-invalido' };
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { status: 'error', reason: 'contenido-invalido' };
  }

  const document = parsed as Record<string, unknown>;

  const version = document.version;
  if (typeof version !== 'number' || !READABLE_VERSIONS.includes(version)) {
    return { status: 'error', reason: 'contenido-invalido' };
  }
  if (!Array.isArray(document.decks) || !Array.isArray(document.cards)) {
    return { status: 'error', reason: 'contenido-invalido' };
  }

  // La versión 1 no guardaba fecha de modificación y no hay forma de deducirla: todos los
  // mazos migrados reciben la misma marca. Entre ellos, el orden por modificación queda en
  // manos del desempate estable por posición.
  let decks: Deck[];
  if (version === 1) {
    if (!document.decks.every(isDeckV1)) {
      return { status: 'error', reason: 'contenido-invalido' };
    }
    decks = (document.decks as Omit<Deck, 'updatedAt'>[]).map((deck) => ({
      id: deck.id,
      name: deck.name,
      updatedAt: now,
    }));
  } else {
    if (!document.decks.every(isDeckV2)) {
      return { status: 'error', reason: 'contenido-invalido' };
    }
    decks = document.decks as Deck[];
  }

  // Antes de la versión 3 no existía la repetición espaciada. Cada carta migrada entra como
  // nueva: conserva todo lo suyo y para el scheduler empieza hoy, sin revisiones inventadas.
  let cards: Card[];
  if (version < STORAGE_VERSION) {
    if (!document.cards.every(isCardV2)) {
      return { status: 'error', reason: 'contenido-invalido' };
    }
    cards = (document.cards as Omit<Card, 'scheduling'>[]).map((card) => ({
      ...card,
      scheduling: { ...newScheduling },
    }));
  } else {
    if (!document.cards.every(isCardV3)) {
      return { status: 'error', reason: 'contenido-invalido' };
    }
    cards = document.cards as Card[];
  }

  // La metadata del scheduler solo existe desde la versión 3. Antes no había scheduler, así
  // que lo honesto es `null`: la escribirá la primera vez que se guarde la biblioteca.
  const rawScheduler = document.scheduler;
  let scheduler: SchedulerMetadata | null = null;
  if (version >= STORAGE_VERSION && rawScheduler !== undefined && rawScheduler !== null) {
    if (!isSchedulerMetadata(rawScheduler)) {
      return { status: 'error', reason: 'contenido-invalido' };
    }
    scheduler = rawScheduler;
  }

  return { status: 'ok', library: { decks, cards, scheduler } };
}
