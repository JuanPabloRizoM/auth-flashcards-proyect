import type { Card } from '../../types/domain';

/**
 * Sesión de estudio simple, sin calificación ni repetición espaciada.
 *
 * Ciclo confirmado: Frente -> Mostrar respuesta -> Frente + Reverso -> Siguiente carta.
 * Funciones puras, testeables sin interfaz (docs/ARCHITECTURE.md, regla 3).
 */

export type StudySession = {
  cards: Card[];
  index: number;
  /** Si el reverso de la carta actual está a la vista. */
  revealed: boolean;
};

export function startSession(cards: Card[]): StudySession {
  return { cards, index: 0, revealed: false };
}

/** Muestra el reverso junto al frente. Idempotente. */
export function revealAnswer(session: StudySession): StudySession {
  if (session.revealed || isFinished(session)) {
    return session;
  }
  return { ...session, revealed: true };
}

/** Avanza a la carta siguiente, que vuelve a mostrarse solo por el frente. */
export function goToNextCard(session: StudySession): StudySession {
  if (isFinished(session)) {
    return session;
  }
  return { ...session, index: session.index + 1, revealed: false };
}

export function currentCard(session: StudySession): Card | undefined {
  return session.cards[session.index];
}

export function isFinished(session: StudySession): boolean {
  return session.index >= session.cards.length;
}

export function isEmpty(session: StudySession): boolean {
  return session.cards.length === 0;
}

/**
 * Progreso dentro de la sesión. `position` es la carta que se está viendo,
 * empezando en 1; al terminar iguala al total.
 */
export function progress(session: StudySession): { position: number; total: number } {
  const total = session.cards.length;
  return { position: Math.min(session.index + 1, total), total };
}
