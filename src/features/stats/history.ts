import type {
  CardAddedEvent,
  DeckSnapshot,
  StudyCardEvent,
  StudyHistory,
  StudySession,
} from './types';

/**
 * Aplicación en memoria de un cambio en el historial.
 *
 * Existe para que el estado visible y el almacenamiento apliquen exactamente la misma
 * regla de mezcla. Si la pantalla sumara los eventos a su manera y el repositorio a la
 * suya, un recargar bastaría para que las cifras cambiaran solas.
 */
export type HistoryChange = {
  trackedSince?: number;
  sessions?: readonly StudySession[];
  cardEvents?: readonly StudyCardEvent[];
  cardAdditions?: readonly CardAddedEvent[];
  deckSnapshots?: readonly DeckSnapshot[];
};

function upsert<T extends { id: string }>(existing: readonly T[], incoming: readonly T[]): T[] {
  if (incoming.length === 0) return [...existing];
  const byId = new Map(existing.map((entry) => [entry.id, entry]));
  for (const entry of incoming) byId.set(entry.id, entry);
  return [...byId.values()];
}

function upsertSnapshots(
  existing: readonly DeckSnapshot[],
  incoming: readonly DeckSnapshot[],
): DeckSnapshot[] {
  if (incoming.length === 0) return [...existing];
  const byDeck = new Map(existing.map((entry) => [entry.deckId, entry]));
  for (const entry of incoming) {
    const previous = byDeck.get(entry.deckId);
    // El snapshot solo avanza: el nombre más reciente gana.
    if (!previous || entry.lastSeenAt >= previous.lastSeenAt) byDeck.set(entry.deckId, entry);
  }
  return [...byDeck.values()];
}

export function applyHistoryChange(history: StudyHistory, change: HistoryChange): StudyHistory {
  return {
    // El inicio del tracking se fija una sola vez y ya no se mueve.
    trackedSince: history.trackedSince ?? change.trackedSince ?? null,
    sessions: upsert(history.sessions, change.sessions ?? []),
    cardEvents: upsert(history.cardEvents, change.cardEvents ?? []),
    cardAdditions: upsert(history.cardAdditions, change.cardAdditions ?? []),
    deckSnapshots: upsertSnapshots(history.deckSnapshots, change.deckSnapshots ?? []),
  };
}

/** Mayor sufijo numérico ya emitido, para que una sesión nueva no repita identificadores. */
export function nextHistoryCounter(history: StudyHistory): number {
  const suffixOf = (id: string): number => {
    const match = /-(\d+)$/.exec(id);
    return match?.[1] ? Number(match[1]) : 0;
  };
  return [...history.sessions, ...history.cardEvents, ...history.cardAdditions].reduce(
    (highest, entry) => Math.max(highest, suffixOf(entry.id)),
    0,
  );
}
