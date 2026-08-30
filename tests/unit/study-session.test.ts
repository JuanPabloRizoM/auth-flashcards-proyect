import { createFsrsScheduler } from '../../src/features/scheduler/fsrsAdapter';
import { newScheduling, type CardScheduling } from '../../src/features/scheduler/types';
import {
  applyRating,
  currentCard,
  isEmpty,
  isFinished,
  progress,
  revealAnswer,
  startSession,
} from '../../src/features/study/session';
import type { Card } from '../../src/types/domain';

/**
 * La sesión de estudio.
 *
 * Funciones puras: reciben la sesión y el resultado que ya calculó el scheduler, y devuelven
 * la sesión siguiente. Lo que se comprueba aquí es la mecánica de la cola dentro de una
 * sesión; el cálculo de intervalos se prueba en scheduler-fsrs y scheduler-golden.
 */

const scheduler = createFsrsScheduler();
const T0 = Date.parse('2026-01-01T10:00:00.000Z');

function carta(id: string, scheduling: CardScheduling = { ...newScheduling }): Card {
  return { id, deckId: 'mazo-1', front: `frente ${id}`, back: `reverso ${id}`, scheduling };
}

const dosNuevas = [carta('carta-1'), carta('carta-2')];

describe('startSession', () => {
  it('empieza por la primera carta elegible, sin revelar', () => {
    const session = startSession(dosNuevas, T0);

    expect(currentCard(session)?.id).toBe('carta-1');
    expect(session.revealed).toBe(false);
    expect(progress(session)).toEqual({ answered: 0, remaining: 2, studied: 0 });
  });

  it('un mazo sin cartas produce una sesión vacía', () => {
    const session = startSession([], T0);

    expect(isEmpty(session)).toBe(true);
    expect(isFinished(session)).toBe(true);
    expect(currentCard(session)).toBeUndefined();
  });

  it('un mazo cuyas cartas están todas programadas para el futuro también queda vacío', () => {
    const futura = carta('carta-3', {
      ...newScheduling,
      state: 'repaso',
      due: T0 + 2 * 86_400_000,
      lastReview: T0 - 86_400_000,
      stability: 10,
      difficulty: 5,
      scheduledDays: 3,
      reps: 2,
    });

    expect(isEmpty(startSession([futura], T0))).toBe(true);
  });
});

describe('revealAnswer', () => {
  it('muestra el reverso y es idempotente', () => {
    const session = revealAnswer(startSession(dosNuevas, T0));

    expect(session.revealed).toBe(true);
    expect(revealAnswer(session)).toBe(session);
  });

  it('no revela nada en una sesión terminada', () => {
    const vacia = startSession([], T0);
    expect(revealAnswer(vacia)).toBe(vacia);
  });
});

describe('applyRating', () => {
  it('una carta que pasa a repaso sale de la sesión', () => {
    const session = revealAnswer(startSession(dosNuevas, T0));
    const outcome = scheduler.rate(dosNuevas[0]!.scheduling, 'facil', T0);
    expect(outcome.scheduling.state).toBe('repaso');

    const next = applyRating(session, outcome);

    expect(next.queue.map((card) => card.id)).toEqual(['carta-2']);
    expect(next.revealed).toBe(false);
    expect(progress(next)).toEqual({ answered: 1, remaining: 1, studied: 1 });
  });

  it('una carta que sigue en aprendizaje vuelve al final de la cola de la sesión', () => {
    const session = revealAnswer(startSession(dosNuevas, T0));
    const outcome = scheduler.rate(dosNuevas[0]!.scheduling, 'otra-vez', T0);
    expect(outcome.scheduling.state).toBe('aprendiendo');

    const next = applyRating(session, outcome);

    expect(next.queue.map((card) => card.id)).toEqual(['carta-2', 'carta-1']);
    // Vuelve con la programación nueva, no con la que tenía al empezar.
    expect(next.queue[1]?.scheduling).toEqual(outcome.scheduling);
  });

  it('no cuenta dos veces la misma carta como estudiada aunque vuelva a salir', () => {
    let session = revealAnswer(startSession([carta('carta-1')], T0));
    session = applyRating(session, scheduler.rate(newScheduling, 'otra-vez', T0));
    session = revealAnswer(session);
    session = applyRating(session, scheduler.rate(session.queue[0]!.scheduling, 'otra-vez', T0));

    expect(progress(session).answered).toBe(2);
    expect(progress(session).studied).toBe(1);
  });

  it('calificar una sesión terminada no inventa nada', () => {
    const vacia = startSession([], T0);
    expect(applyRating(vacia, scheduler.rate(newScheduling, 'bien', T0))).toBe(vacia);
  });

  it('terminar todas las cartas deja la sesión finalizada pero no vacía', () => {
    let session = revealAnswer(startSession(dosNuevas, T0));
    session = applyRating(session, scheduler.rate(dosNuevas[0]!.scheduling, 'facil', T0));
    session = revealAnswer(session);
    session = applyRating(session, scheduler.rate(dosNuevas[1]!.scheduling, 'facil', T0));

    expect(isFinished(session)).toBe(true);
    expect(isEmpty(session)).toBe(false);
    expect(progress(session).studied).toBe(2);
  });
});
