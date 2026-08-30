import { createFsrsScheduler } from '../../src/features/scheduler/fsrsAdapter';
import {
  isPassingRating,
  newScheduling,
  reviewRatingLabels,
  reviewRatings,
} from '../../src/features/scheduler/types';
import { buildStatsReport } from '../../src/features/stats/engine';
import { retentionExclusionNotice } from '../../src/features/stats/view';
import { biblioteca, carta, historial, mazo, resetSequence, revision } from '../fixtures/stats/builders';

/**
 * Semántica de las calificaciones.
 *
 * Existe un test dedicado, y no una comprobación de pasada dentro de otro, porque aquí es
 * donde alguien puede equivocarse de la forma más cara: tratar **Difícil como un fallo**.
 * Difícil significa "me acordaba, pero me costó", y es aprobatoria
 * (docs/PRODUCT.md, 2026-08-30). El único fallo es Otra vez.
 *
 * También se separa aquí la confusión entre el **botón Difícil** y la **Difficulty de FSRS**,
 * que son cosas distintas: uno es una respuesta puntual, la otra una propiedad de la carta.
 */

const HOY = '2026-03-10';
const AHORA = Date.parse(`${HOY}T12:00:00Z`);

beforeEach(resetSequence);

describe('isPassingRating', () => {
  it('Otra vez es un fallo', () => {
    expect(isPassingRating('otra-vez')).toBe(false);
  });

  it('Difícil es un acierto, no un fallo', () => {
    expect(isPassingRating('dificil')).toBe(true);
  });

  it('Bien es un acierto', () => {
    expect(isPassingRating('bien')).toBe(true);
  });

  it('Fácil es un acierto', () => {
    expect(isPassingRating('facil')).toBe(true);
  });

  it('solo hay una calificación que sea fallo', () => {
    expect(reviewRatings.filter((rating) => !isPassingRating(rating))).toEqual(['otra-vez']);
  });
});

describe('etiquetas', () => {
  it('se muestran en español', () => {
    expect(reviewRatingLabels).toEqual({
      'otra-vez': 'Otra vez',
      dificil: 'Difícil',
      bien: 'Bien',
      facil: 'Fácil',
    });
  });
});

describe('retención', () => {
  function retencionDe(rating: (typeof reviewRatings)[number]) {
    const input = {
      library: biblioteca([mazo('mazo-a', 'Inglés')], []),
      history: historial({
        ratedSince: AHORA,
        reviews: [revision({ deckId: 'mazo-a', cardId: 'carta-1', day: HOY, rating })],
      }),
    };
    return buildStatsReport(input, { scope: { kind: 'all' }, period: 'all', today: HOY, now: AHORA })
      .trueRetention.rows.find((row) => row.key === 'hoy')!.total;
  }

  it('Otra vez cuenta como fallo', () => {
    expect(retencionDe('otra-vez')).toEqual({ passed: 0, failed: 1, total: 1, retention: 0 });
  });

  it('Difícil cuenta como acierto', () => {
    expect(retencionDe('dificil')).toEqual({ passed: 1, failed: 0, total: 1, retention: 100 });
  });

  it('Bien cuenta como acierto', () => {
    expect(retencionDe('bien')).toEqual({ passed: 1, failed: 0, total: 1, retention: 100 });
  });

  it('Fácil cuenta como acierto', () => {
    expect(retencionDe('facil')).toEqual({ passed: 1, failed: 0, total: 1, retention: 100 });
  });

  it('tres aciertos de distinto tipo y un fallo dan el 75 %', () => {
    const input = {
      library: biblioteca([mazo('mazo-a', 'Inglés')], []),
      history: historial({
        ratedSince: AHORA,
        reviews: [
          revision({ deckId: 'mazo-a', cardId: 'c-1', day: HOY, rating: 'dificil' }),
          revision({ deckId: 'mazo-a', cardId: 'c-2', day: HOY, rating: 'bien' }),
          revision({ deckId: 'mazo-a', cardId: 'c-3', day: HOY, rating: 'facil' }),
          revision({ deckId: 'mazo-a', cardId: 'c-4', day: HOY, rating: 'otra-vez' }),
        ],
      }),
    };

    const fila = buildStatsReport(input, {
      scope: { kind: 'all' },
      period: 'all',
      today: HOY,
      now: AHORA,
    }).trueRetention.rows.find((row) => row.key === 'hoy')!;

    expect(fila.total).toEqual({ passed: 3, failed: 1, total: 4, retention: 75 });
  });
});

describe('Difficulty no es el botón Difícil', () => {
  it('la distribución de dificultad sale del estado de las cartas, no de las calificaciones', () => {
    const scheduler = createFsrsScheduler();
    // Una carta con dificultad baja, obtenida calificándola Fácil.
    const facil = scheduler.rate(newScheduling, 'facil', AHORA).scheduling;

    const input = {
      library: biblioteca([mazo('mazo-a', 'Inglés')], [carta('carta-1', 'mazo-a', facil)]),
      history: historial({
        ratedSince: AHORA,
        // Muchas calificaciones "Difícil" en el historial de otras cartas.
        reviews: Array.from({ length: 20 }, (_, index) =>
          revision({ deckId: 'mazo-a', cardId: `otra-${index}`, day: HOY, rating: 'dificil' }),
        ),
      }),
    };

    const report = buildStatsReport(input, {
      scope: { kind: 'all' },
      period: 'all',
      today: HOY,
      now: AHORA,
    });

    // Veinte "Difícil" en Answer Buttons…
    expect(report.answerButtons.slices.find((slice) => slice.rating === 'dificil')?.reviews).toBe(20);
    // …y una sola muestra de dificultad, la de la única carta que existe, que es baja.
    expect(report.difficulty.samples).toBe(1);
    expect(report.difficulty.median).toBeCloseTo(facil.difficulty, 2);
    expect(report.difficulty.median!).toBeLessThan(5);
  });
});

describe('lo que queda fuera de la retención se dice', () => {
  function informeCon(revisionesDeAprendizaje: number) {
    const input = {
      library: biblioteca([mazo('mazo-a', 'Inglés')], []),
      history: historial({
        ratedSince: AHORA,
        reviews: Array.from({ length: revisionesDeAprendizaje }, (_, index) =>
          revision({
            deckId: 'mazo-a',
            cardId: `apr-${index}`,
            day: HOY,
            previousState: 'aprendiendo',
          }),
        ),
      }),
    };
    return buildStatsReport(input, {
      scope: { kind: 'all' },
      period: 'all',
      today: HOY,
      now: AHORA,
    });
  }

  it('sin nada excluido no se dice nada', () => {
    expect(retentionExclusionNotice(informeCon(0))).toBeNull();
  });

  it('con una sola respuesta excluida lo dice en singular', () => {
    expect(retentionExclusionNotice(informeCon(1))).toBe(
      '1 respuesta queda fuera por ser de una tarjeta que todavía se estaba aprendiendo.',
    );
  });

  it('con varias lo dice en plural y con la cifra correcta', () => {
    expect(retentionExclusionNotice(informeCon(3))).toBe(
      '3 respuestas quedan fuera por ser de tarjetas que todavía se estaban aprendiendo.',
    );
  });
});
