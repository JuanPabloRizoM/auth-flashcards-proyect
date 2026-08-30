import { createFsrsScheduler } from '../../src/features/scheduler/fsrsAdapter';
import { newScheduling } from '../../src/features/scheduler/types';
import { buildStatsReport, type StatsInput } from '../../src/features/stats/engine';
import { countUnratedEvents, median } from '../../src/features/stats/fsrs';
import { addDays } from '../../src/features/stats/time';
import type { StatsPeriod, StatsScope } from '../../src/features/stats/types';
import {
  biblioteca,
  carta,
  cartaEnRepaso,
  evento,
  historial,
  mazo,
  programacion,
  resetSequence,
  revision,
} from '../fixtures/stats/builders';

/**
 * Las estadísticas que dependen del scheduler.
 *
 * Dataset pequeño y calculable a mano: dos mazos, cartas con estados conocidos y revisiones
 * declaradas una a una. Todo se afirma contra números concretos, no contra "mayor que cero".
 */

const HOY = '2026-03-10';
const AHORA = Date.parse(`${HOY}T12:00:00Z`);
const DAY = 86_400_000;

beforeEach(resetSequence);

function consulta(partes: Partial<{ scope: StatsScope; period: StatsPeriod; now: number }> = {}) {
  return {
    scope: partes.scope ?? ({ kind: 'all' } as StatsScope),
    period: partes.period ?? ('all' as StatsPeriod),
    today: HOY,
    now: partes.now ?? AHORA,
  };
}

// ── Answer Buttons ───────────────────────────────────────────────────────────

describe('Answer Buttons', () => {
  /** Inglés: 2 Otra vez, 3 Difícil, 4 Bien, 1 Fácil. Matemáticas: 5 Bien. */
  function dataset(): StatsInput {
    const reviews = [
      ...Array.from({ length: 2 }, (_, i) =>
        revision({ deckId: 'mazo-a', cardId: `a-again-${i}`, day: HOY, rating: 'otra-vez' }),
      ),
      ...Array.from({ length: 3 }, (_, i) =>
        revision({ deckId: 'mazo-a', cardId: `a-hard-${i}`, day: HOY, rating: 'dificil' }),
      ),
      ...Array.from({ length: 4 }, (_, i) =>
        revision({ deckId: 'mazo-a', cardId: `a-good-${i}`, day: HOY, rating: 'bien' }),
      ),
      revision({ deckId: 'mazo-a', cardId: 'a-easy-0', day: HOY, rating: 'facil' }),
      ...Array.from({ length: 5 }, (_, i) =>
        revision({ deckId: 'mazo-b', cardId: `b-good-${i}`, day: HOY, rating: 'bien' }),
      ),
    ];
    return {
      library: biblioteca([mazo('mazo-a', 'Inglés'), mazo('mazo-b', 'Matemáticas')], []),
      history: historial({ ratedSince: AHORA, reviews }),
    };
  }

  const conteo = (input: StatsInput, scope: StatsScope, period: StatsPeriod = 'all') => {
    const { answerButtons } = buildStatsReport(input, consulta({ scope, period }));
    return Object.fromEntries(
      answerButtons.slices.map((slice) => [slice.rating, slice.reviews]),
    ) as Record<string, number>;
  };

  it('cuenta las veces que se usó Otra vez', () => {
    expect(conteo(dataset(), { kind: 'deck', deckId: 'mazo-a' })['otra-vez']).toBe(2);
  });

  it('cuenta las veces que se usó Difícil', () => {
    expect(conteo(dataset(), { kind: 'deck', deckId: 'mazo-a' }).dificil).toBe(3);
  });

  it('cuenta las veces que se usó Bien', () => {
    expect(conteo(dataset(), { kind: 'deck', deckId: 'mazo-a' }).bien).toBe(4);
  });

  it('cuenta las veces que se usó Fácil', () => {
    expect(conteo(dataset(), { kind: 'deck', deckId: 'mazo-a' }).facil).toBe(1);
  });

  it('con ámbito global suma los dos mazos', () => {
    const report = buildStatsReport(dataset(), consulta());
    expect(report.answerButtons.total).toBe(15);
    expect(conteo(dataset(), { kind: 'all' }).bien).toBe(9);
  });

  it('con ámbito de un mazo solo cuenta el suyo', () => {
    const report = buildStatsReport(
      dataset(),
      consulta({ scope: { kind: 'deck', deckId: 'mazo-b' } }),
    );
    expect(report.answerButtons.total).toBe(5);
    expect(report.answerButtons.slices.find((s) => s.rating === 'bien')?.reviews).toBe(5);
    expect(report.answerButtons.slices.find((s) => s.rating === 'dificil')?.reviews).toBe(0);
  });

  it('los porcentajes se calculan sobre el total del ámbito', () => {
    const report = buildStatsReport(
      dataset(),
      consulta({ scope: { kind: 'deck', deckId: 'mazo-a' } }),
    );
    expect(report.answerButtons.slices.find((s) => s.rating === 'bien')?.percent).toBe(40);
  });

  describe('periodos', () => {
    function conAntiguedad(): StatsInput {
      return {
        library: biblioteca([mazo('mazo-a', 'Inglés')], []),
        history: historial({
          ratedSince: AHORA,
          reviews: [
            revision({ deckId: 'mazo-a', cardId: 'c-hoy', day: HOY }),
            revision({ deckId: 'mazo-a', cardId: 'c-60', day: addDays(HOY, -60) }),
            revision({ deckId: 'mazo-a', cardId: 'c-200', day: addDays(HOY, -200) }),
            revision({ deckId: 'mazo-a', cardId: 'c-500', day: addDays(HOY, -500) }),
          ],
        }),
      };
    }

    const totalEn = (period: StatsPeriod) =>
      buildStatsReport(conAntiguedad(), consulta({ period })).answerButtons.total;

    it('1 mes deja fuera lo de hace 60 días', () => {
      expect(totalEn('1m')).toBe(1);
    });

    it('3 meses incluye lo de hace 60 días y no lo de hace 200', () => {
      expect(totalEn('3m')).toBe(2);
    });

    it('1 año incluye lo de hace 200 días y no lo de hace 500', () => {
      expect(totalEn('1y')).toBe(3);
    });

    it('todo el historial los incluye a los cuatro', () => {
      expect(totalEn('all')).toBe(4);
    });
  });

  it('una tarjeta calificada no se cuenta además como actividad sin calificar', () => {
    // El emparejamiento es por carta e instante: quien registra una calificación cierra el
    // evento de la carta con el mismo instante. Si eso se rompiera, cada tarjeta calificada
    // se contaría dos veces —una como calificación y otra como "sin calificar"— y este test
    // lo enseñaría.
    const al = Date.parse(`${HOY}T10:00:00Z`);
    const input: StatsInput = {
      library: biblioteca([mazo('mazo-a', 'Inglés')], []),
      history: historial({
        ratedSince: al,
        cardEvents: [
          { ...evento({ deckId: 'mazo-a', day: HOY, cardId: 'c-1' }), completedAt: al },
          { ...evento({ deckId: 'mazo-a', day: HOY, cardId: 'c-2' }), completedAt: al },
        ],
        reviews: [
          { ...revision({ deckId: 'mazo-a', cardId: 'c-1', day: HOY }), reviewedAt: al },
          { ...revision({ deckId: 'mazo-a', cardId: 'c-2', day: HOY }), reviewedAt: al },
        ],
      }),
    };

    const { answerButtons } = buildStatsReport(input, consulta());

    expect(answerButtons.total).toBe(2);
    expect(answerButtons.unrated).toBe(0);
  });

  it('mezcla actividad calificada y sin calificar sin sumar ninguna dos veces', () => {
    const al = Date.parse(`${HOY}T10:00:00Z`);
    const input: StatsInput = {
      library: biblioteca([mazo('mazo-a', 'Inglés')], []),
      history: historial({
        ratedSince: al,
        cardEvents: [
          // Una calificada…
          { ...evento({ deckId: 'mazo-a', day: HOY, cardId: 'c-1' }), completedAt: al },
          // …y dos de antes de que existiera la calificación.
          evento({ deckId: 'mazo-a', day: HOY, cardId: 'viejo-1' }),
          evento({ deckId: 'mazo-a', day: HOY, cardId: 'viejo-2' }),
        ],
        reviews: [{ ...revision({ deckId: 'mazo-a', cardId: 'c-1', day: HOY }), reviewedAt: al }],
      }),
    };

    const { answerButtons } = buildStatsReport(input, consulta());

    expect(answerButtons.total).toBe(1);
    expect(answerButtons.unrated).toBe(2);
  });

  it('la actividad anterior a la calificación se cuenta aparte, nunca como quinta opción', () => {
    const input: StatsInput = {
      library: biblioteca([mazo('mazo-a', 'Inglés')], []),
      history: historial({
        ratedSince: null,
        cardEvents: [
          evento({ deckId: 'mazo-a', day: HOY }),
          evento({ deckId: 'mazo-a', day: HOY }),
          evento({ deckId: 'mazo-a', day: HOY }),
        ],
      }),
    };

    const { answerButtons } = buildStatsReport(input, consulta());

    expect(answerButtons.total).toBe(0);
    expect(answerButtons.slices).toHaveLength(4);
    expect(answerButtons.unrated).toBe(3);
    expect(answerButtons.ratedSince).toBeNull();
  });
});

// ── True Retention ───────────────────────────────────────────────────────────

describe('True Retention', () => {
  const fila = (input: StatsInput, key: string, scope: StatsScope = { kind: 'all' }) =>
    buildStatsReport(input, consulta({ scope })).trueRetention.rows.find((row) => row.key === key)!;

  it('solo cuenta la primera revisión calificable de cada tarjeta en cada día', () => {
    const input: StatsInput = {
      library: biblioteca([mazo('mazo-a', 'Inglés')], []),
      history: historial({
        ratedSince: AHORA,
        reviews: [
          // La misma carta, tres veces el mismo día: falla y luego la repite hasta acertar.
          revision({ deckId: 'mazo-a', cardId: 'c-1', day: HOY, hour: 9, rating: 'otra-vez', id: 'r-1' }),
          revision({ deckId: 'mazo-a', cardId: 'c-1', day: HOY, hour: 10, rating: 'bien', id: 'r-2' }),
          revision({ deckId: 'mazo-a', cardId: 'c-1', day: HOY, hour: 11, rating: 'facil', id: 'r-3' }),
        ],
      }),
    };

    // Un solo evento, el primero, y es el fallo.
    expect(fila(input, 'hoy').total).toEqual({ passed: 0, failed: 1, total: 1, retention: 0 });
  });

  it('separa Young y Mature por el intervalo que la tarjeta tenía en ese momento', () => {
    const input: StatsInput = {
      library: biblioteca([mazo('mazo-a', 'Inglés')], []),
      history: historial({
        ratedSince: AHORA,
        reviews: [
          revision({ deckId: 'mazo-a', cardId: 'y-1', day: HOY, previousIntervalDays: 5, rating: 'bien' }),
          revision({ deckId: 'mazo-a', cardId: 'y-2', day: HOY, previousIntervalDays: 20, rating: 'otra-vez' }),
          revision({ deckId: 'mazo-a', cardId: 'm-1', day: HOY, previousIntervalDays: 21, rating: 'bien' }),
          revision({ deckId: 'mazo-a', cardId: 'm-2', day: HOY, previousIntervalDays: 90, rating: 'bien' }),
        ],
      }),
    };

    const hoy = fila(input, 'hoy');
    expect(hoy.young).toEqual({ passed: 1, failed: 1, total: 2, retention: 50 });
    expect(hoy.mature).toEqual({ passed: 2, failed: 0, total: 2, retention: 100 });
    expect(hoy.total).toEqual({ passed: 3, failed: 1, total: 4, retention: 75 });
  });

  it('el total es la suma de Young y Mature', () => {
    const input: StatsInput = {
      library: biblioteca([mazo('mazo-a', 'Inglés')], []),
      history: historial({
        ratedSince: AHORA,
        reviews: [
          revision({ deckId: 'mazo-a', cardId: 'y-1', day: HOY, previousIntervalDays: 3 }),
          revision({ deckId: 'mazo-a', cardId: 'm-1', day: HOY, previousIntervalDays: 40 }),
        ],
      }),
    };

    const hoy = fila(input, 'hoy');
    expect(hoy.total.total).toBe(hoy.young.total + hoy.mature.total);
    expect(hoy.total.passed).toBe(hoy.young.passed + hoy.mature.passed);
  });

  it('cubre hoy, ayer, la última semana, el último mes, el último año y todo', () => {
    const input: StatsInput = {
      library: biblioteca([mazo('mazo-a', 'Inglés')], []),
      history: historial({
        ratedSince: AHORA,
        reviews: [
          revision({ deckId: 'mazo-a', cardId: 'c-hoy', day: HOY }),
          revision({ deckId: 'mazo-a', cardId: 'c-ayer', day: addDays(HOY, -1) }),
          revision({ deckId: 'mazo-a', cardId: 'c-5', day: addDays(HOY, -5) }),
          revision({ deckId: 'mazo-a', cardId: 'c-20', day: addDays(HOY, -20) }),
          revision({ deckId: 'mazo-a', cardId: 'c-200', day: addDays(HOY, -200) }),
          revision({ deckId: 'mazo-a', cardId: 'c-500', day: addDays(HOY, -500) }),
        ],
      }),
    };

    expect(fila(input, 'hoy').total.total).toBe(1);
    expect(fila(input, 'ayer').total.total).toBe(1);
    expect(fila(input, 'semana').total.total).toBe(3);
    expect(fila(input, 'mes').total.total).toBe(4);
    expect(fila(input, 'ano').total.total).toBe(5);
    expect(fila(input, 'todo').total.total).toBe(6);
  });

  it('sin ninguna calificación la retención es desconocida, no cero por ciento', () => {
    const input: StatsInput = {
      library: biblioteca([mazo('mazo-a', 'Inglés')], []),
      history: historial({
        ratedSince: null,
        cardEvents: [evento({ deckId: 'mazo-a', day: HOY }), evento({ deckId: 'mazo-a', day: HOY })],
      }),
    };

    const hoy = fila(input, 'hoy');
    expect(hoy.total.retention).toBeNull();
    expect(hoy.total.total).toBe(0);
  });

  it('deja fuera las revisiones de tarjetas que aún estaban aprendiéndose, y lo dice', () => {
    const input: StatsInput = {
      library: biblioteca([mazo('mazo-a', 'Inglés')], []),
      history: historial({
        ratedSince: AHORA,
        reviews: [
          revision({ deckId: 'mazo-a', cardId: 'c-1', day: HOY, previousState: 'nueva', rating: 'otra-vez' }),
          revision({ deckId: 'mazo-a', cardId: 'c-2', day: HOY, previousState: 'aprendiendo', rating: 'otra-vez' }),
          revision({ deckId: 'mazo-a', cardId: 'c-3', day: HOY, previousState: 'repaso', rating: 'bien' }),
        ],
      }),
    };

    const report = buildStatsReport(input, consulta());
    expect(report.trueRetention.excludedLearning).toBe(2);
    expect(report.trueRetention.rows.find((row) => row.key === 'hoy')!.total).toEqual({
      passed: 1,
      failed: 0,
      total: 1,
      retention: 100,
    });
  });

  it('respeta el filtro de mazo', () => {
    const input: StatsInput = {
      library: biblioteca([mazo('mazo-a', 'Inglés'), mazo('mazo-b', 'Matemáticas')], []),
      history: historial({
        ratedSince: AHORA,
        reviews: [
          revision({ deckId: 'mazo-a', cardId: 'a-1', day: HOY, rating: 'otra-vez' }),
          revision({ deckId: 'mazo-b', cardId: 'b-1', day: HOY, rating: 'bien' }),
        ],
      }),
    };

    expect(fila(input, 'hoy', { kind: 'deck', deckId: 'mazo-a' }).total.retention).toBe(0);
    expect(fila(input, 'hoy', { kind: 'deck', deckId: 'mazo-b' }).total.retention).toBe(100);
    expect(fila(input, 'hoy').total.retention).toBe(50);
  });
});

// ── Future Due ───────────────────────────────────────────────────────────────

describe('Future Due', () => {
  /** Inglés con vencimientos a 1, 1, 5, 40 y 400 días; Matemáticas a 2 días. */
  function dataset(): StatsInput {
    const cards = [
      cartaEnRepaso('a-1', 'mazo-a', { intervalo: 4, enDias: 1, desde: AHORA }),
      cartaEnRepaso('a-2', 'mazo-a', { intervalo: 4, enDias: 1, desde: AHORA }),
      cartaEnRepaso('a-3', 'mazo-a', { intervalo: 10, enDias: 5, desde: AHORA }),
      cartaEnRepaso('a-4', 'mazo-a', { intervalo: 30, enDias: 40, desde: AHORA }),
      cartaEnRepaso('a-5', 'mazo-a', { intervalo: 200, enDias: 400, desde: AHORA }),
      // Una carta nueva: no está programada para ningún día y no debe aparecer.
      carta('a-nueva', 'mazo-a'),
      // Una carta ya vencida: no es futuro, es atraso.
      cartaEnRepaso('a-vencida', 'mazo-a', { intervalo: 6, enDias: -2, desde: AHORA }),
      cartaEnRepaso('b-1', 'mazo-b', { intervalo: 4, enDias: 2, desde: AHORA }),
    ];
    return {
      library: biblioteca([mazo('mazo-a', 'Inglés'), mazo('mazo-b', 'Matemáticas')], cards),
      history: historial({ ratedSince: AHORA }),
    };
  }

  it('muestra las revisiones programadas para mañana', () => {
    const { futureDue } = buildStatsReport(dataset(), consulta({ period: '1m' }));
    const manana = futureDue.buckets.find((bucket) => bucket.offset === 1)!;

    expect(manana.day).toBe(addDays(HOY, 1));
    // a-1 y a-2 vencen mañana; b-1 vence pasado mañana y no cuenta aquí.
    expect(manana.reviews).toBe(2);
  });

  it('mañana solo tiene las que vencen mañana', () => {
    const { futureDue } = buildStatsReport(
      dataset(),
      consulta({ period: '1m', scope: { kind: 'deck', deckId: 'mazo-a' } }),
    );
    expect(futureDue.buckets.find((bucket) => bucket.offset === 1)!.reviews).toBe(2);
    expect(futureDue.buckets.find((bucket) => bucket.offset === 5)!.reviews).toBe(1);
  });

  it('el horizonte de 1 mes cubre 30 días y deja fuera lo de 40 y 400', () => {
    const { futureDue } = buildStatsReport(dataset(), consulta({ period: '1m' }));

    expect(futureDue.horizonDays).toBe(30);
    expect(futureDue.buckets).toHaveLength(31);
    expect(futureDue.total).toBe(4); // a-1, a-2, a-3 y b-1
    expect(futureDue.beyondHorizon).toBe(2);
  });

  it('el horizonte de 3 meses incluye la de 40 días', () => {
    const { futureDue } = buildStatsReport(dataset(), consulta({ period: '3m' }));

    expect(futureDue.horizonDays).toBe(90);
    expect(futureDue.total).toBe(5);
    expect(futureDue.beyondHorizon).toBe(1);
  });

  it('el horizonte de 1 año sigue dejando fuera la de 400 días', () => {
    const { futureDue } = buildStatsReport(dataset(), consulta({ period: '1y' }));

    expect(futureDue.horizonDays).toBe(365);
    expect(futureDue.total).toBe(5);
    expect(futureDue.beyondHorizon).toBe(1);
  });

  it('el horizonte completo llega hasta la carta más lejana', () => {
    const { futureDue } = buildStatsReport(dataset(), consulta({ period: 'all' }));

    expect(futureDue.horizonDays).toBeNull();
    expect(futureDue.total).toBe(6);
    expect(futureDue.beyondHorizon).toBe(0);
    expect(futureDue.buckets[futureDue.buckets.length - 1]?.offset).toBe(400);
  });

  it('las tarjetas ya vencidas se cuentan como atraso, no como futuro', () => {
    const { futureDue } = buildStatsReport(dataset(), consulta({ period: 'all' }));
    expect(futureDue.backlog).toBe(1);
  });

  it('sin nada programado, la media diaria es desconocida y no cero', () => {
    const soloNuevas: StatsInput = {
      library: biblioteca([mazo('mazo-a', 'Inglés')], [carta('a-1', 'mazo-a')]),
      history: historial(),
    };

    const { futureDue } = buildStatsReport(soloNuevas, consulta());

    expect(futureDue.total).toBe(0);
    expect(futureDue.averagePerDay).toBeNull();
    expect(futureDue.busiestDay).toBeNull();
  });

  it('las tarjetas nuevas no aparecen: todavía no tienen fecha real', () => {
    const soloNuevas: StatsInput = {
      library: biblioteca([mazo('mazo-a', 'Inglés')], [carta('a-1', 'mazo-a'), carta('a-2', 'mazo-a')]),
      history: historial(),
    };

    const { futureDue } = buildStatsReport(soloNuevas, consulta());
    expect(futureDue.total).toBe(0);
    expect(futureDue.backlog).toBe(0);
  });

  it('respeta el filtro de mazo', () => {
    const soloB = buildStatsReport(
      dataset(),
      consulta({ period: 'all', scope: { kind: 'deck', deckId: 'mazo-b' } }),
    ).futureDue;

    expect(soloB.total).toBe(1);
    expect(soloB.buckets.find((bucket) => bucket.offset === 2)!.reviews).toBe(1);
  });

  it('una tarjeta eliminada de la biblioteca deja de generar Future Due', () => {
    const input = dataset();
    const sinLaCarta: StatsInput = {
      ...input,
      library: {
        ...input.library,
        cards: input.library.cards.filter((card) => card.id !== 'a-5'),
      },
    };

    expect(buildStatsReport(sinLaCarta, consulta({ period: 'all' })).futureDue.total).toBe(5);
  });
});

// ── Card Counts ──────────────────────────────────────────────────────────────

describe('Card Counts por estado del scheduler', () => {
  function dataset(): StatsInput {
    const cards = [
      carta('nueva-1', 'mazo-a'),
      carta('nueva-2', 'mazo-a'),
      carta('apr-1', 'mazo-a', programacion({ state: 'aprendiendo', due: AHORA, reps: 1, stability: 0.5, difficulty: 6 })),
      carta('rea-1', 'mazo-a', programacion({ state: 'reaprendiendo', due: AHORA, reps: 5, lapses: 1, stability: 0.7, difficulty: 8 })),
      cartaEnRepaso('young-1', 'mazo-a', { intervalo: 5, enDias: 1, desde: AHORA }),
      cartaEnRepaso('young-2', 'mazo-a', { intervalo: 20, enDias: 1, desde: AHORA }),
      cartaEnRepaso('mature-1', 'mazo-a', { intervalo: 21, enDias: 10, desde: AHORA }),
      cartaEnRepaso('mature-2', 'mazo-a', { intervalo: 100, enDias: 50, desde: AHORA }),
      cartaEnRepaso('b-1', 'mazo-b', { intervalo: 60, enDias: 30, desde: AHORA }),
    ];
    return {
      library: biblioteca([mazo('mazo-a', 'Inglés'), mazo('mazo-b', 'Matemáticas')], cards),
      history: historial(),
    };
  }

  const cuenta = (scope: StatsScope = { kind: 'all' }) =>
    buildStatsReport(dataset(), consulta({ scope })).counts;

  it('cuenta las Nuevas', () => {
    expect(cuenta().scheduler.nuevas).toBe(2);
  });

  it('cuenta las que están Aprendiendo', () => {
    expect(cuenta().scheduler.aprendiendo).toBe(1);
  });

  it('cuenta las que están Reaprendiendo', () => {
    expect(cuenta().scheduler.reaprendiendo).toBe(1);
  });

  it('cuenta las Young: repaso con intervalo menor de 21 días', () => {
    expect(cuenta().scheduler.young).toBe(2);
  });

  it('cuenta las Mature: repaso con intervalo de 21 días o más', () => {
    expect(cuenta().scheduler.mature).toBe(3);
  });

  it('el total es exactamente la suma de los cinco estados', () => {
    const counts = cuenta();
    const { nuevas, aprendiendo, reaprendiendo, young, mature } = counts.scheduler;

    expect(nuevas + aprendiendo + reaprendiendo + young + mature).toBe(counts.total);
    expect(counts.total).toBe(9);
  });

  it('respeta el filtro de mazo', () => {
    const soloB = cuenta({ kind: 'deck', deckId: 'mazo-b' });

    expect(soloB.total).toBe(1);
    expect(soloB.scheduler.mature).toBe(1);
    expect(soloB.scheduler.nuevas).toBe(0);
  });
});

// ── Review Intervals ─────────────────────────────────────────────────────────

describe('Review Intervals', () => {
  function dataset(): StatsInput {
    const cards = [
      cartaEnRepaso('a-1', 'mazo-a', { intervalo: 1, enDias: 1, desde: AHORA }),
      cartaEnRepaso('a-2', 'mazo-a', { intervalo: 3, enDias: 1, desde: AHORA }),
      cartaEnRepaso('a-3', 'mazo-a', { intervalo: 7, enDias: 1, desde: AHORA }),
      cartaEnRepaso('a-4', 'mazo-a', { intervalo: 25, enDias: 1, desde: AHORA }),
      cartaEnRepaso('a-5', 'mazo-a', { intervalo: 100, enDias: 1, desde: AHORA }),
      carta('a-nueva', 'mazo-a'),
      cartaEnRepaso('b-1', 'mazo-b', { intervalo: 500, enDias: 1, desde: AHORA }),
    ];
    return {
      library: biblioteca([mazo('mazo-a', 'Inglés'), mazo('mazo-b', 'Matemáticas')], cards),
      history: historial(),
    };
  }

  it('reparte los intervalos reales por rango', () => {
    const { reviewIntervals } = buildStatsReport(
      dataset(),
      consulta({ scope: { kind: 'deck', deckId: 'mazo-a' } }),
    );

    expect(reviewIntervals.samples).toBe(5);
    const porRango = Object.fromEntries(
      reviewIntervals.buckets.map((bucket) => [bucket.key, bucket.count]),
    );
    expect(porRango['0-1']).toBe(1); // 1 día
    expect(porRango['2-3']).toBe(1); // 3 días
    expect(porRango['4-7']).toBe(1); // 7 días
    expect(porRango['22-30']).toBe(1); // 25 días
    expect(porRango['91-180']).toBe(1); // 100 días
  });

  it('calcula la mediana de los intervalos', () => {
    const { reviewIntervals } = buildStatsReport(
      dataset(),
      consulta({ scope: { kind: 'deck', deckId: 'mazo-a' } }),
    );

    // 1, 3, 7, 25, 100 → la mediana es 7.
    expect(reviewIntervals.median).toBe(7);
    expect(reviewIntervals.max).toBe(100);
  });

  it('las cartas nuevas no entran en la distribución', () => {
    const soloNuevas: StatsInput = {
      library: biblioteca([mazo('mazo-a', 'Inglés')], [carta('a-1', 'mazo-a')]),
      history: historial(),
    };

    const { reviewIntervals } = buildStatsReport(soloNuevas, consulta());
    expect(reviewIntervals.samples).toBe(0);
    expect(reviewIntervals.median).toBeNull();
  });

  it('está aislado por mazo', () => {
    const soloB = buildStatsReport(
      dataset(),
      consulta({ scope: { kind: 'deck', deckId: 'mazo-b' } }),
    ).reviewIntervals;

    expect(soloB.samples).toBe(1);
    expect(soloB.median).toBe(500);
    expect(soloB.buckets.find((bucket) => bucket.key === '91-180')?.count).toBe(0);
  });
});

// ── Stability y Difficulty ───────────────────────────────────────────────────

describe('FSRS Stability', () => {
  function dataset(): StatsInput {
    const cards = [
      cartaEnRepaso('a-1', 'mazo-a', { intervalo: 5, enDias: 1, desde: AHORA, stability: 2 }),
      cartaEnRepaso('a-2', 'mazo-a', { intervalo: 5, enDias: 1, desde: AHORA, stability: 10 }),
      cartaEnRepaso('a-3', 'mazo-a', { intervalo: 5, enDias: 1, desde: AHORA, stability: 40 }),
      carta('a-nueva-1', 'mazo-a'),
      carta('a-nueva-2', 'mazo-a'),
    ];
    return {
      library: biblioteca([mazo('mazo-a', 'Inglés')], cards),
      history: historial(),
    };
  }

  it('todos los valores considerados son positivos y finitos', () => {
    const { stability } = buildStatsReport(dataset(), consulta());

    expect(stability.samples).toBe(3);
    expect(stability.min).toBe(2);
    expect(stability.max).toBe(40);
  });

  it('reparte por rango y calcula la mediana', () => {
    const { stability } = buildStatsReport(dataset(), consulta());
    const porRango = Object.fromEntries(stability.buckets.map((b) => [b.key, b.count]));

    expect(stability.median).toBe(10);
    expect(porRango['1-3']).toBe(1);
    expect(porRango['7-14']).toBe(1);
    expect(porRango['30-90']).toBe(1);
  });

  it('las cartas nuevas no se cuentan como si tuvieran estabilidad', () => {
    const soloNuevas: StatsInput = {
      library: biblioteca([mazo('mazo-a', 'Inglés')], [carta('a-1', 'mazo-a'), carta('a-2', 'mazo-a')]),
      history: historial(),
    };

    const { stability } = buildStatsReport(soloNuevas, consulta());
    expect(stability.samples).toBe(0);
    expect(stability.median).toBeNull();
    // Sin muestra, ni mínimo ni máximo ni media: son preguntas sin respuesta, no ceros.
    expect(stability.min).toBeNull();
    expect(stability.max).toBeNull();
    expect(stability.average).toBeNull();
    expect(stability.buckets.every((bucket) => bucket.count === 0)).toBe(true);
  });
});

describe('FSRS Difficulty', () => {
  it('reparte en los rangos de 1 a 10 y calcula media y mediana', () => {
    const cards = [
      cartaEnRepaso('a-1', 'mazo-a', { intervalo: 5, enDias: 1, desde: AHORA, difficulty: 2.5 }),
      cartaEnRepaso('a-2', 'mazo-a', { intervalo: 5, enDias: 1, desde: AHORA, difficulty: 5.5 }),
      cartaEnRepaso('a-3', 'mazo-a', { intervalo: 5, enDias: 1, desde: AHORA, difficulty: 9.5 }),
      carta('a-nueva', 'mazo-a'),
    ];
    const input: StatsInput = {
      library: biblioteca([mazo('mazo-a', 'Inglés')], cards),
      history: historial(),
    };

    const { difficulty } = buildStatsReport(input, consulta());

    expect(difficulty.samples).toBe(3);
    expect(difficulty.median).toBe(5.5);
    expect(difficulty.average).toBeCloseTo(5.83, 2);
    expect(difficulty.buckets).toHaveLength(9);
    expect(difficulty.buckets.reduce((sum, bucket) => sum + bucket.count, 0)).toBe(3);
    expect(difficulty.buckets.find((bucket) => bucket.key === '2')?.count).toBe(1);
    expect(difficulty.buckets.find((bucket) => bucket.key === '5')?.count).toBe(1);
    expect(difficulty.buckets.find((bucket) => bucket.key === '9')?.count).toBe(1);
  });
});

// ── Retrievability ───────────────────────────────────────────────────────────

describe('Retrievability', () => {
  const scheduler = createFsrsScheduler();

  /** Una carta real llevada hasta repaso, para que la curva de olvido sea la de verdad. */
  function enRepaso(id: string, deckId: string) {
    const scheduling = scheduler.rate(newScheduling, 'facil', AHORA).scheduling;
    return carta(id, deckId, scheduling);
  }

  function dataset(): StatsInput {
    return {
      library: biblioteca(
        [mazo('mazo-a', 'Inglés'), mazo('mazo-b', 'Matemáticas')],
        [enRepaso('a-1', 'mazo-a'), enRepaso('a-2', 'mazo-a'), enRepaso('b-1', 'mazo-b'), carta('a-nueva', 'mazo-a')],
      ),
      history: historial(),
    };
  }

  it('se calcula para el instante que se le pasa y es reproducible', () => {
    const primera = buildStatsReport(dataset(), consulta()).retrievability;
    const segunda = buildStatsReport(dataset(), consulta()).retrievability;

    expect(primera.samples).toBe(3);
    expect(primera.median).toBe(segunda.median);
    expect(primera.median).toBeGreaterThan(99);
  });

  it('baja al avanzar el reloj', () => {
    const ahora = buildStatsReport(dataset(), consulta()).retrievability;
    const dentroDeUnMes = buildStatsReport(
      dataset(),
      consulta({ now: AHORA + 30 * DAY }),
    ).retrievability;

    expect(dentroDeUnMes.median!).toBeLessThan(ahora.median!);
    expect(dentroDeUnMes.samples).toBe(3);
  });

  it('las cartas nuevas no se miden: no tienen curva de olvido', () => {
    const { retrievability } = buildStatsReport(dataset(), consulta());
    expect(retrievability.samples).toBe(3);
  });

  it('se filtra por mazo', () => {
    const soloB = buildStatsReport(
      dataset(),
      consulta({ scope: { kind: 'deck', deckId: 'mazo-b' } }),
    ).retrievability;

    expect(soloB.samples).toBe(1);
  });

  it('los rangos cubren de 0 a 100 y suman las muestras', () => {
    const { retrievability } = buildStatsReport(dataset(), consulta({ now: AHORA + 5 * DAY }));

    expect(retrievability.buckets).toHaveLength(10);
    expect(retrievability.buckets.reduce((sum, bucket) => sum + bucket.count, 0)).toBe(
      retrievability.samples,
    );
  });
});

// ── Aislamiento entre mazos ──────────────────────────────────────────────────

describe('aislamiento entre mazos', () => {
  it('con 10 revisiones en un mazo y 30 en otro, el global cuenta 40 y cada uno el suyo', () => {
    const input: StatsInput = {
      library: biblioteca(
        [mazo('mazo-a', 'Inglés'), mazo('mazo-b', 'Matemáticas')],
        [
          cartaEnRepaso('a-1', 'mazo-a', { intervalo: 5, enDias: 3, desde: AHORA }),
          cartaEnRepaso('b-1', 'mazo-b', { intervalo: 5, enDias: 4, desde: AHORA }),
          cartaEnRepaso('b-2', 'mazo-b', { intervalo: 5, enDias: 4, desde: AHORA }),
        ],
      ),
      history: historial({
        ratedSince: AHORA,
        reviews: [
          ...Array.from({ length: 10 }, (_, i) =>
            revision({ deckId: 'mazo-a', cardId: `a-${i}`, day: HOY }),
          ),
          ...Array.from({ length: 30 }, (_, i) =>
            revision({ deckId: 'mazo-b', cardId: `b-${i}`, day: HOY }),
          ),
        ],
      }),
    };

    const global = buildStatsReport(input, consulta());
    const soloA = buildStatsReport(input, consulta({ scope: { kind: 'deck', deckId: 'mazo-a' } }));
    const soloB = buildStatsReport(input, consulta({ scope: { kind: 'deck', deckId: 'mazo-b' } }));

    expect(global.answerButtons.total).toBe(40);
    expect(soloA.answerButtons.total).toBe(10);
    expect(soloB.answerButtons.total).toBe(30);

    // Future Due respeta el mismo aislamiento.
    expect(global.futureDue.total).toBe(3);
    expect(soloA.futureDue.total).toBe(1);
    expect(soloB.futureDue.total).toBe(2);

    // Y la retención también.
    expect(global.trueRetention.rows.find((r) => r.key === 'hoy')!.total.total).toBe(40);
    expect(soloA.trueRetention.rows.find((r) => r.key === 'hoy')!.total.total).toBe(10);
    expect(soloB.trueRetention.rows.find((r) => r.key === 'hoy')!.total.total).toBe(30);
  });
});

describe('median', () => {
  it('con un número impar de valores es el central', () => {
    expect(median([3, 1, 2])).toBe(2);
  });

  it('con un número par es la media de los dos centrales', () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });

  it('sin muestra no es cero: es desconocida', () => {
    expect(median([])).toBeNull();
  });
});

describe('métricas diferidas', () => {
  it('Card Ease se declara con su motivo: FSRS no usa Ease', () => {
    const { deferred } = buildStatsReport(
      { library: biblioteca(), history: historial() },
      consulta(),
    );

    expect(deferred.map((metric) => metric.anki)).toEqual(['Card Ease']);
    expect(deferred[0]!.reason).toContain('Difficulty');
  });
});

describe('countUnratedEvents', () => {
  const review = (cardId: string, at: number) => ({
    ...revision({ deckId: 'mazo-a', cardId, day: HOY }),
    reviewedAt: at,
  });

  it('sin ninguna calificación, todo lo completado está sin calificar', () => {
    expect(
      countUnratedEvents(
        [
          { cardId: 'c-1', completedAt: 100 },
          { cardId: 'c-2', completedAt: 200 },
        ],
        [],
      ),
    ).toBe(2);
  });

  it('un evento cerrado en el mismo instante que su calificación no cuenta', () => {
    expect(countUnratedEvents([{ cardId: 'c-1', completedAt: 100 }], [review('c-1', 100)])).toBe(0);
  });

  it('la misma carta en otro instante sí cuenta: es otra aparición', () => {
    expect(countUnratedEvents([{ cardId: 'c-1', completedAt: 999 }], [review('c-1', 100)])).toBe(1);
  });

  it('un evento sin completar se empareja contra 0 y no puede robar una calificación', () => {
    expect(countUnratedEvents([{ cardId: 'c-1', completedAt: null }], [review('c-1', 100)])).toBe(1);
  });
});
