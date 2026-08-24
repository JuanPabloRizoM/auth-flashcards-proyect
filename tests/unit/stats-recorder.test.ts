import {
  beginSession,
  completeCard,
  endSession,
  isWorthPersisting,
  revealAnswer,
  showCard,
} from '../../src/features/stats/recorder';
import { localDayOf, localHourOf } from '../../src/features/stats/time';

/**
 * Registro de una sesión.
 *
 * Se reproduce una sesión completa con instantes elegidos y se afirma sobre los valores
 * exactos. El reloj no se lee dentro del registrador, así que no hay nada que simular.
 */

/** Un martes cualquiera a las 10:00 locales. Todos los instantes se derivan de aquí. */
const T0 = new Date(2026, 7, 18, 10, 0, 0).getTime();
const segundos = (n: number) => T0 + n * 1000;

describe('Ciclo de una sesión', () => {
  it('empezar una sesión guarda id, mazo, inicio y día local', () => {
    const { session } = beginSession({ sessionId: 'sesion-1', deckId: 'mazo-a', at: T0 });

    expect(session).toEqual({
      id: 'sesion-1',
      deckId: 'mazo-a',
      startedAt: T0,
      endedAt: null,
      activeMs: 0,
      completedCards: 0,
      localDay: localDayOf(T0),
    });
  });

  it('mostrar una carta crea el evento con sus cinco identidades y el instante', () => {
    let recording = beginSession({ sessionId: 'sesion-1', deckId: 'mazo-a', at: T0 });
    recording = showCard(recording, { eventId: 'evento-1', cardId: 'carta-7', at: segundos(2) });

    expect(recording.pending).toEqual({
      id: 'evento-1',
      sessionId: 'sesion-1',
      deckId: 'mazo-a',
      cardId: 'carta-7',
      shownAt: segundos(2),
      revealedAt: null,
      completedAt: null,
      activeMs: 0,
      localDay: localDayOf(segundos(2)),
      localHour: localHourOf(segundos(2)),
    });
    // Todavía no hay nada completado: mostrar no es estudiar.
    expect(recording.events).toEqual([]);
  });

  it('revelar la respuesta queda registrado y solo cuenta la primera vez', () => {
    let recording = beginSession({ sessionId: 'sesion-1', deckId: 'mazo-a', at: T0 });
    recording = showCard(recording, { eventId: 'evento-1', cardId: 'carta-7', at: T0 });
    recording = revealAnswer(recording, segundos(9));
    recording = revealAnswer(recording, segundos(30));

    expect(recording.pending?.revealedAt).toBe(segundos(9));
  });

  it('completar la carta la cierra, la suma a la sesión y deja de haber pendiente', () => {
    let recording = beginSession({ sessionId: 'sesion-1', deckId: 'mazo-a', at: T0 });
    recording = showCard(recording, { eventId: 'evento-1', cardId: 'carta-7', at: T0 });
    recording = revealAnswer(recording, segundos(9));
    recording = completeCard(recording, { at: segundos(24), activeMs: 24_000 });

    expect(recording.pending).toBeNull();
    expect(recording.events).toHaveLength(1);
    expect(recording.events[0]).toMatchObject({
      id: 'evento-1',
      cardId: 'carta-7',
      shownAt: T0,
      revealedAt: segundos(9),
      completedAt: segundos(24),
      activeMs: 24_000,
    });
    expect(recording.session.completedCards).toBe(1);
    expect(recording.session.activeMs).toBe(24_000);
  });

  it('terminar la sesión fija el fin y deja duración y cartas coherentes con los eventos', () => {
    // Tres cartas de 20, 30 y 10 segundos activos: 60 s y 3 cartas.
    let recording = beginSession({ sessionId: 'sesion-1', deckId: 'mazo-a', at: T0 });
    const duraciones = [20_000, 30_000, 10_000];
    duraciones.forEach((activeMs, index) => {
      recording = showCard(recording, {
        eventId: `evento-${index + 1}`,
        cardId: `carta-${index + 1}`,
        at: segundos(index * 60),
      });
      recording = revealAnswer(recording, segundos(index * 60 + 5));
      recording = completeCard(recording, { at: segundos(index * 60 + 40), activeMs });
    });
    recording = endSession(recording, segundos(200));

    expect(recording.session.endedAt).toBe(segundos(200));
    expect(recording.session.completedCards).toBe(3);
    expect(recording.session.activeMs).toBe(60_000);
    // La duración de la sesión es exactamente la suma de sus cartas: no puede discrepar.
    expect(recording.events.reduce((sum, event) => sum + event.activeMs, 0)).toBe(
      recording.session.activeMs,
    );
  });

  it('terminar dos veces no mueve el instante de fin', () => {
    let recording = beginSession({ sessionId: 'sesion-1', deckId: 'mazo-a', at: T0 });
    recording = endSession(recording, segundos(10));
    recording = endSession(recording, segundos(999));

    expect(recording.session.endedAt).toBe(segundos(10));
  });
});

describe('Cartas abandonadas', () => {
  it('mostrar otra carta descarta la anterior sin completar', () => {
    let recording = beginSession({ sessionId: 'sesion-1', deckId: 'mazo-a', at: T0 });
    recording = showCard(recording, { eventId: 'evento-1', cardId: 'carta-1', at: T0 });
    recording = showCard(recording, { eventId: 'evento-2', cardId: 'carta-2', at: segundos(60) });

    expect(recording.events).toEqual([]);
    expect(recording.pending?.cardId).toBe('carta-2');
    expect(recording.session.completedCards).toBe(0);
    expect(recording.session.activeMs).toBe(0);
  });

  it('terminar con una carta a la vista no la cuenta como estudiada', () => {
    let recording = beginSession({ sessionId: 'sesion-1', deckId: 'mazo-a', at: T0 });
    recording = showCard(recording, { eventId: 'evento-1', cardId: 'carta-1', at: T0 });
    recording = endSession(recording, segundos(3600));

    expect(recording.events).toEqual([]);
    expect(recording.session.activeMs).toBe(0);
    expect(isWorthPersisting(recording)).toBe(false);
  });

  it('una sesión con al menos una carta completada sí merece guardarse', () => {
    let recording = beginSession({ sessionId: 'sesion-1', deckId: 'mazo-a', at: T0 });
    recording = showCard(recording, { eventId: 'evento-1', cardId: 'carta-1', at: T0 });
    recording = completeCard(recording, { at: segundos(10), activeMs: 10_000 });

    expect(isWorthPersisting(recording)).toBe(true);
  });
});

describe('Robustez', () => {
  it('completar sin carta a la vista no cambia nada', () => {
    const recording = beginSession({ sessionId: 'sesion-1', deckId: 'mazo-a', at: T0 });
    expect(completeCard(recording, { at: segundos(10), activeMs: 5_000 })).toBe(recording);
  });

  it('una duración activa negativa se guarda como cero, nunca resta tiempo', () => {
    let recording = beginSession({ sessionId: 'sesion-1', deckId: 'mazo-a', at: T0 });
    recording = showCard(recording, { eventId: 'evento-1', cardId: 'carta-1', at: T0 });
    recording = completeCard(recording, { at: segundos(10), activeMs: -5_000 });

    expect(recording.events[0]?.activeMs).toBe(0);
    expect(recording.session.activeMs).toBe(0);
  });

  it('las duraciones se redondean a milisegundos enteros', () => {
    let recording = beginSession({ sessionId: 'sesion-1', deckId: 'mazo-a', at: T0 });
    recording = showCard(recording, { eventId: 'evento-1', cardId: 'carta-1', at: T0 });
    recording = completeCard(recording, { at: segundos(10), activeMs: 1234.6 });

    expect(recording.events[0]?.activeMs).toBe(1235);
  });
});
