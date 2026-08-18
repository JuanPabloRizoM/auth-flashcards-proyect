import {
  currentCard,
  goToNextCard,
  isEmpty,
  isFinished,
  progress,
  revealAnswer,
  startSession,
} from '../../src/features/study/session';
import type { Card } from '../../src/types/domain';

const cartas: Card[] = [
  { id: 'carta-1', deckId: 'mazo-1', front: 'to overlook', back: 'pasar por alto' },
  { id: 'carta-2', deckId: 'mazo-1', front: 'to withstand', back: 'resistir' },
];

describe('sesión de estudio', () => {
  it('empieza en la primera carta con el reverso oculto', () => {
    const session = startSession(cartas);

    expect(session.revealed).toBe(false);
    expect(currentCard(session)?.front).toBe('to overlook');
    expect(progress(session)).toEqual({ position: 1, total: 2 });
    expect(isFinished(session)).toBe(false);
  });

  it('muestra la respuesta sin cambiar de carta', () => {
    const session = revealAnswer(startSession(cartas));

    expect(session.revealed).toBe(true);
    expect(currentCard(session)?.front).toBe('to overlook');
    expect(progress(session)).toEqual({ position: 1, total: 2 });
  });

  it('mostrar la respuesta dos veces no cambia nada', () => {
    const unaVez = revealAnswer(startSession(cartas));

    expect(revealAnswer(unaVez)).toBe(unaVez);
  });

  it('la carta siguiente vuelve a ocultar el reverso', () => {
    const session = goToNextCard(revealAnswer(startSession(cartas)));

    expect(session.revealed).toBe(false);
    expect(currentCard(session)?.front).toBe('to withstand');
    expect(progress(session)).toEqual({ position: 2, total: 2 });
    expect(isFinished(session)).toBe(false);
  });

  it('termina después de la última carta', () => {
    let session = startSession(cartas);
    session = goToNextCard(revealAnswer(session));
    session = goToNextCard(revealAnswer(session));

    expect(isFinished(session)).toBe(true);
    expect(currentCard(session)).toBeUndefined();
    expect(progress(session)).toEqual({ position: 2, total: 2 });
  });

  it('avanzar una sesión terminada no la altera', () => {
    let session = startSession(cartas);
    session = goToNextCard(session);
    session = goToNextCard(session);

    expect(goToNextCard(session)).toBe(session);
    expect(revealAnswer(session)).toBe(session);
  });

  it('recorre el ciclo completo confirmado', () => {
    const recorrido: string[] = [];
    let session = startSession(cartas);

    while (!isFinished(session)) {
      const card = currentCard(session);
      recorrido.push(`frente:${card?.front}`);
      session = revealAnswer(session);
      recorrido.push(`reverso:${currentCard(session)?.back}`);
      session = goToNextCard(session);
    }

    expect(recorrido).toEqual([
      'frente:to overlook',
      'reverso:pasar por alto',
      'frente:to withstand',
      'reverso:resistir',
    ]);
  });

  it('una sesión sin cartas está vacía y terminada a la vez', () => {
    const session = startSession([]);

    expect(isEmpty(session)).toBe(true);
    expect(isFinished(session)).toBe(true);
    expect(progress(session)).toEqual({ position: 0, total: 0 });
  });

  it('una sesión con cartas no está vacía', () => {
    expect(isEmpty(startSession(cartas))).toBe(false);
  });
});
