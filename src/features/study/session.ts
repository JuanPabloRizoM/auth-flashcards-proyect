import type { CardScheduling, SchedulingOutcome } from '../scheduler/types';

import type { Card } from '../../types/domain';

import { buildStudyQueue } from './queue';

/**
 * Sesión de estudio dirigida por el scheduler.
 *
 * Ciclo confirmado: Frente -> Mostrar respuesta -> Frente + Reverso -> Otra vez / Difícil /
 * Bien / Fácil -> siguiente tarjeta elegible (docs/PRODUCT.md, 2026-08-30).
 *
 * Funciones puras, testeables sin interfaz (docs/ARCHITECTURE.md, regla 3). La sesión no
 * lee el reloj ni califica por su cuenta: recibe el resultado que ya ha calculado el
 * scheduler.
 *
 * ## Qué pasa con una carta después de calificarla
 *
 * - Si sigue en aprendizaje o reaprendizaje, **vuelve al final de la cola de esta sesión**.
 *   Su vencimiento está a minutos, y hacer esperar a la persona usuaria mirando una
 *   pantalla vacía hasta que el reloj lo alcance sería absurdo. Es el comportamiento que
 *   cualquiera espera al pulsar "Otra vez".
 * - Si pasa a repaso, con un vencimiento a días, **sale de la sesión**: ya no toca hoy.
 *
 * La regla es determinista y no depende del minuto exacto en que se califique, que es lo
 * que permite probarla sin esperar.
 */

export type StudySession = {
  /** Cartas pendientes, en orden. La primera es la que está a la vista. */
  queue: Card[];
  /** Si el reverso de la carta actual está a la vista. */
  revealed: boolean;
  /** Calificaciones aplicadas en esta sesión, repeticiones incluidas. */
  answered: number;
  /** Cartas distintas calificadas al menos una vez en esta sesión. */
  studiedCardIds: string[];
};

export function startSession(cards: readonly Card[], now: number): StudySession {
  return { queue: buildStudyQueue(cards, now), revealed: false, answered: 0, studiedCardIds: [] };
}

/** Muestra el reverso junto al frente. Idempotente. */
export function revealAnswer(session: StudySession): StudySession {
  if (session.revealed || isFinished(session)) {
    return session;
  }
  return { ...session, revealed: true };
}

const staysInSession = (scheduling: CardScheduling): boolean =>
  scheduling.state === 'aprendiendo' || scheduling.state === 'reaprendiendo';

/**
 * Aplica una calificación ya calculada y avanza a la carta siguiente.
 *
 * Devuelve la sesión sin tocar si no había ninguna carta a la vista: así una pulsación que
 * llegue tarde, cuando la sesión ya ha terminado, no puede inventar una calificación.
 */
export function applyRating(session: StudySession, outcome: SchedulingOutcome): StudySession {
  const card = currentCard(session);
  if (!card) {
    return session;
  }

  const rest = session.queue.slice(1);
  const updated: Card = { ...card, scheduling: outcome.scheduling };
  const queue = staysInSession(outcome.scheduling) ? [...rest, updated] : rest;

  return {
    queue,
    revealed: false,
    answered: session.answered + 1,
    studiedCardIds: session.studiedCardIds.includes(card.id)
      ? session.studiedCardIds
      : [...session.studiedCardIds, card.id],
  };
}

export function currentCard(session: StudySession): Card | undefined {
  return session.queue[0];
}

export function isFinished(session: StudySession): boolean {
  return session.queue.length === 0;
}

/** Una sesión que empezó sin ninguna carta elegible. */
export function isEmpty(session: StudySession): boolean {
  return session.queue.length === 0 && session.answered === 0;
}

/**
 * Progreso de la sesión.
 *
 * `remaining` incluye las cartas que volverán a aparecer por seguir en aprendizaje, así que
 * puede no bajar al calificar con "Otra vez". Es la verdad: esa carta sigue pendiente.
 */
export function progress(session: StudySession): {
  answered: number;
  remaining: number;
  studied: number;
} {
  return {
    answered: session.answered,
    remaining: session.queue.length,
    studied: session.studiedCardIds.length,
  };
}
