import {
  isPassingRating,
  MATURE_INTERVAL_DAYS,
  reviewRatings,
  type ReviewRating,
  type SpacedRepetitionScheduler,
} from '../scheduler/types';

import type { Card } from '../../types/domain';

import { addDays, dayInRange, daysBetween, localDayOf, type PeriodRange } from './time';
import type { StatsScope, StudyReviewEvent } from './types';

/**
 * Estadísticas de repetición espaciada.
 *
 * Todo lo de aquí es puro: entra la biblioteca, el registro de revisiones y un instante, y
 * sale un informe. No se lee el reloj, no se toca el almacenamiento y no se conoce React
 * (docs/ARCHITECTURE.md, reglas 1 y 3). Vive en un archivo aparte de `engine.ts` solo por
 * tamaño: es el mismo motor, y `engine.ts` es quien lo llama y quien decide el filtrado por
 * ámbito y periodo, de modo que no puede haber dos criterios distintos.
 *
 * ## Dos familias de métricas, y por qué se filtran distinto
 *
 * - **De actividad** (Answer Buttons, True Retention): describen lo que pasó. El periodo
 *   las acota, igual que a las secciones de TASK-006.
 * - **De inventario** (Card Counts, Review Intervals, Stability, Difficulty,
 *   Retrievability): describen cómo está hoy la biblioteca. Un intervalo no tiene un "hace
 *   tres meses": es el que la carta tiene ahora. Se filtran por ámbito, no por periodo, que
 *   es el mismo convenio que ya seguían el conteo de tarjetas y el origen.
 * - **Future Due** mira hacia delante, así que el periodo funciona como horizonte.
 *
 * ## Nada se inventa
 *
 * Los eventos anteriores a TASK-007 registran que una carta se estudió, no cómo salió. No
 * se convierten en aciertos ni en fallos: quedan fuera de las métricas que dependen de la
 * calificación, y el informe dice desde cuándo hay datos para que la ausencia se entienda
 * (docs/PRODUCT.md, 2026-08-30).
 */

// ── Utilidades ───────────────────────────────────────────────────────────────

/** División que devuelve `null` en vez de `NaN` cuando no hay divisor. */
function ratio(numerator: number, denominator: number): number | null {
  return denominator > 0 ? numerator / denominator : null;
}

function round1(value: number | null): number | null {
  return value === null ? null : Math.round(value * 10) / 10;
}

function round2(value: number | null): number | null {
  return value === null ? null : Math.round(value * 100) / 100;
}

/**
 * Mediana de una muestra.
 *
 * Con un número par de valores es la media de los dos centrales. `null` si no hay muestra:
 * la mediana de nada no es cero.
 */
export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle]!;
  return (sorted[middle - 1]! + sorted[middle]!) / 2;
}

function matchesScope(deckId: string, scope: StatsScope): boolean {
  return scope.kind === 'all' || scope.deckId === deckId;
}

// ── Distribuciones ───────────────────────────────────────────────────────────

/** Un tramo de una distribución. `to` es `null` en el último, que no tiene tope. */
export type DistributionBucket = {
  key: string;
  label: string;
  from: number;
  to: number | null;
  count: number;
};

export type DistributionStats = {
  buckets: DistributionBucket[];
  /** Cuántos valores entraron. 0 significa "no hay nada que distribuir", no "todo vale 0". */
  samples: number;
  median: number | null;
  average: number | null;
  min: number | null;
  max: number | null;
};

type BucketSpec = { key: string; label: string; from: number; to: number | null };

function distribute(values: readonly number[], specs: readonly BucketSpec[]): DistributionStats {
  const counts = new Map<string, number>(specs.map((spec) => [spec.key, 0]));
  for (const value of values) {
    // El primer tramo cuyo tope supera el valor. El último no tiene tope y recoge el resto.
    const spec = specs.find((candidate) => candidate.to === null || value < candidate.to);
    if (spec) counts.set(spec.key, (counts.get(spec.key) ?? 0) + 1);
  }
  const total = values.reduce((sum, value) => sum + value, 0);
  return {
    buckets: specs.map((spec) => ({ ...spec, count: counts.get(spec.key) ?? 0 })),
    samples: values.length,
    median: round2(median(values)),
    average: round2(ratio(total, values.length)),
    // Se recorre en vez de usar `Math.min(...values)`: con muestras grandes, esparcir el
    // array como argumentos desborda la pila.
    min: values.length ? values.reduce((low, value) => Math.min(low, value), Infinity) : null,
    max: values.length ? values.reduce((high, value) => Math.max(high, value), -Infinity) : null,
  };
}

/** Tramos de intervalo, en días. Los cortes acompañan a la frontera Young/Mature (21 días). */
const intervalBuckets: readonly BucketSpec[] = [
  { key: '0-1', label: '1 día', from: 0, to: 2 },
  { key: '2-3', label: '2–3 días', from: 2, to: 4 },
  { key: '4-7', label: '4–7 días', from: 4, to: 8 },
  { key: '8-14', label: '8–14 días', from: 8, to: 15 },
  { key: '15-21', label: '15–21 días', from: 15, to: 22 },
  { key: '22-30', label: '22–30 días', from: 22, to: 31 },
  { key: '31-60', label: '1–2 meses', from: 31, to: 61 },
  { key: '61-90', label: '2–3 meses', from: 61, to: 91 },
  { key: '91-180', label: '3–6 meses', from: 91, to: 181 },
  { key: '181-365', label: '6–12 meses', from: 181, to: 366 },
  { key: '365+', label: 'Más de 1 año', from: 366, to: null },
];

/** Tramos de estabilidad, en días. Misma escala que los intervalos: se leen juntas. */
const stabilityBuckets: readonly BucketSpec[] = [
  { key: '0-1', label: 'Menos de 1 día', from: 0, to: 1 },
  { key: '1-3', label: '1–3 días', from: 1, to: 3 },
  { key: '3-7', label: '3–7 días', from: 3, to: 7 },
  { key: '7-14', label: '1–2 semanas', from: 7, to: 14 },
  { key: '14-30', label: '2–4 semanas', from: 14, to: 30 },
  { key: '30-90', label: '1–3 meses', from: 30, to: 90 },
  { key: '90-180', label: '3–6 meses', from: 90, to: 180 },
  { key: '180-365', label: '6–12 meses', from: 180, to: 365 },
  { key: '365+', label: 'Más de 1 año', from: 365, to: null },
];

/** Dificultad de FSRS: va de 1 a 10, en nueve tramos de una unidad. */
const difficultyBuckets: readonly BucketSpec[] = Array.from({ length: 9 }, (_, index) => {
  const from = index + 1;
  const to = index === 8 ? null : from + 1;
  return { key: `${from}`, label: `${from}–${from + 1}`, from, to };
});

/** Probabilidad de recuerdo, en porcentaje, de diez en diez. */
const retrievabilityBuckets: readonly BucketSpec[] = Array.from({ length: 10 }, (_, index) => {
  const from = index * 10;
  const to = index === 9 ? null : from + 10;
  return { key: `${from}`, label: `${from}–${from + 10} %`, from, to };
});

// ── Answer Buttons ───────────────────────────────────────────────────────────

export type AnswerButtonSlice = {
  rating: ReviewRating;
  reviews: number;
  /** 0..100. Es 0 solo cuando de verdad no se usó esa calificación. */
  percent: number;
};

export type AnswerButtonsStats = {
  slices: AnswerButtonSlice[];
  total: number;
  /** Cuándo se registró la primera calificación. `null` si todavía no hay ninguna. */
  ratedSince: number | null;
  /**
   * Cartas completadas en el ámbito y periodo que no tienen calificación asociada.
   *
   * Son actividad anterior a TASK-007. No se cuentan como una quinta categoría ni se
   * reparten entre las cuatro: se dicen aparte para que la gráfica se entienda.
   */
  unrated: number;
};

export function buildAnswerButtons(
  reviews: readonly StudyReviewEvent[],
  unrated: number,
  ratedSince: number | null,
): AnswerButtonsStats {
  const counts = new Map<ReviewRating, number>(reviewRatings.map((rating) => [rating, 0]));
  for (const review of reviews) {
    counts.set(review.rating, (counts.get(review.rating) ?? 0) + 1);
  }
  const total = reviews.length;
  return {
    slices: reviewRatings.map((rating) => {
      const value = counts.get(rating) ?? 0;
      return { rating, reviews: value, percent: round1(ratio(value * 100, total)) ?? 0 };
    }),
    total,
    ratedSince,
    unrated,
  };
}

// ── True Retention ───────────────────────────────────────────────────────────

export type RetentionCell = {
  passed: number;
  failed: number;
  total: number;
  /** 0..100. `null` sin muestras: una retención sin repasos no es 0 %, es desconocida. */
  retention: number | null;
};

export type RetentionRow = {
  key: string;
  label: string;
  young: RetentionCell;
  mature: RetentionCell;
  total: RetentionCell;
};

export type TrueRetentionStats = {
  rows: RetentionRow[];
  ratedSince: number | null;
  /** Revisiones descartadas por no ser de una carta en repaso. Ver el comentario de abajo. */
  excludedLearning: number;
};

/**
 * Ventanas de la tabla de retención.
 *
 * Son suyas y no del selector de periodo: la retención se lee comparando hoy con ayer y con
 * el último mes, y obligarla a un único periodo perdería justamente esa comparación. El
 * filtro de mazo sí se aplica, como a todo lo demás.
 */
const retentionWindows: readonly { key: string; label: string; days: number | null }[] = [
  { key: 'hoy', label: 'Hoy', days: 1 },
  { key: 'ayer', label: 'Ayer', days: 0 },
  { key: 'semana', label: 'Última semana', days: 7 },
  { key: 'mes', label: 'Último mes', days: 30 },
  { key: 'ano', label: 'Último año', days: 365 },
  { key: 'todo', label: 'Todo el historial', days: null },
];

const emptyCell: RetentionCell = { passed: 0, failed: 0, total: 0, retention: null };

function cellOf(reviews: readonly StudyReviewEvent[]): RetentionCell {
  let passed = 0;
  let failed = 0;
  for (const review of reviews) {
    if (isPassingRating(review.rating)) passed += 1;
    else failed += 1;
  }
  const total = passed + failed;
  return { passed, failed, total, retention: round1(ratio(passed * 100, total)) };
}

/**
 * Primera revisión calificable de cada carta en cada día.
 *
 * Anki cuenta un repaso por carta y día para la retención: si alguien falla una carta y la
 * repite hasta acertarla, la tarde entera no puede convertirse en cuatro aciertos y un
 * fallo. Se conserva la primera, que es la que responde a "¿te acordabas?".
 */
function firstReviewPerCardPerDay(
  reviews: readonly StudyReviewEvent[],
): StudyReviewEvent[] {
  const first = new Map<string, StudyReviewEvent>();
  for (const review of reviews) {
    const key = `${review.cardId}|${review.localDay}`;
    const previous = first.get(key);
    if (
      !previous ||
      review.reviewedAt < previous.reviewedAt ||
      (review.reviewedAt === previous.reviewedAt && review.id < previous.id)
    ) {
      first.set(key, review);
    }
  }
  return [...first.values()];
}

export function buildTrueRetention(
  reviews: readonly StudyReviewEvent[],
  today: string,
  ratedSince: number | null,
): TrueRetentionStats {
  // Solo las revisiones de cartas que estaban en repaso. Es la definición de True Retention:
  // mide si te acordabas de algo ya aprendido. Los pasos de aprendizaje y de reaprendizaje
  // son parte de aprenderlo, y meterlos aquí hundiría la cifra sin significar lo mismo. La
  // cantidad excluida se informa para que la omisión no sea invisible.
  const reviewStage = reviews.filter((review) => review.previousState === 'repaso');
  const excludedLearning = reviews.length - reviewStage.length;
  const qualifying = firstReviewPerCardPerDay(reviewStage);

  const rows = retentionWindows.map(({ key, label, days }) => {
    let selection: StudyReviewEvent[];
    if (key === 'ayer') {
      const yesterday = addDays(today, -1);
      selection = qualifying.filter((review) => review.localDay === yesterday);
    } else if (days === null) {
      selection = [...qualifying];
    } else {
      const from = addDays(today, -(days - 1));
      selection = qualifying.filter(
        (review) => review.localDay >= from && review.localDay <= today,
      );
    }

    const young = selection.filter((r) => r.previousIntervalDays < MATURE_INTERVAL_DAYS);
    const mature = selection.filter((r) => r.previousIntervalDays >= MATURE_INTERVAL_DAYS);
    return {
      key,
      label,
      young: young.length ? cellOf(young) : emptyCell,
      mature: mature.length ? cellOf(mature) : emptyCell,
      total: selection.length ? cellOf(selection) : emptyCell,
    };
  });

  return { rows, ratedSince, excludedLearning };
}

// ── Future Due ───────────────────────────────────────────────────────────────

export type FutureDueBucket = {
  day: string;
  /** Días desde hoy. 0 es hoy más tarde, 1 es mañana. */
  offset: number;
  reviews: number;
};

export type FutureDueStats = {
  buckets: FutureDueBucket[];
  /** Revisiones programadas dentro del horizonte. */
  total: number;
  /** Cartas ya vencidas ahora mismo: no son futuro, son atraso. */
  backlog: number;
  /** Programadas más allá del horizonte elegido. */
  beyondHorizon: number;
  /** Días que cubre el horizonte. `null` en "todo". */
  horizonDays: number | null;
  daysWithReviews: number;
  busiestDay: FutureDueBucket | null;
  /** Media diaria dentro del horizonte. `null` si no hay ninguna programada. */
  averagePerDay: number | null;
};

/**
 * Cartas completadas que no tienen una calificación asociada.
 *
 * Son actividad anterior a TASK-007: se estudiaron, pero nadie registró cómo salieron. Se
 * cuentan aparte para poder decirlo, nunca como una quinta calificación.
 *
 * El emparejamiento es por carta e instante porque quien registra una calificación cierra a
 * la vez el evento de la carta con **el mismo instante** (ver `StudyHistoryProvider.review`).
 * Es un invariante del registro, y hay un test que lo fija: con calificaciones reales, este
 * recuento tiene que ser cero.
 */
export function countUnratedEvents(
  events: readonly { cardId: string; completedAt: number | null }[],
  reviews: readonly StudyReviewEvent[],
): number {
  const rated = new Set(reviews.map((review) => `${review.cardId}|${review.reviewedAt}`));
  return events.filter((event) => !rated.has(`${event.cardId}|${event.completedAt ?? 0}`)).length;
}

/**
 * Revisiones programadas hacia delante.
 *
 * Solo cuentan las cartas que **existen ahora** en la biblioteca y que tienen una fecha real
 * de revisión: las nuevas no aparecen, porque una carta nueva no está programada para
 * ningún día, y una carta eliminada tampoco, porque ya no va a aparecer nunca
 * (docs/PRODUCT.md, 2026-08-30).
 */
export function buildFutureDue(
  cards: readonly Card[],
  now: number,
  today: string,
  horizonDays: number | null,
): FutureDueStats {
  let backlog = 0;
  let beyondHorizon = 0;
  const byOffset = new Map<number, number>();
  let maxOffset = 0;

  for (const { scheduling } of cards) {
    if (scheduling.state === 'nueva' || scheduling.due === null) continue;
    if (scheduling.due <= now) {
      backlog += 1;
      continue;
    }
    const offset = Math.max(0, daysBetween(today, localDayOf(scheduling.due)));
    if (horizonDays !== null && offset > horizonDays) {
      beyondHorizon += 1;
      continue;
    }
    byOffset.set(offset, (byOffset.get(offset) ?? 0) + 1);
    maxOffset = Math.max(maxOffset, offset);
  }

  // En "todo el historial" el horizonte lo marca la carta más lejana. Dibujar mil días
  // vacíos porque sí no informaría de nada.
  const span = horizonDays ?? maxOffset;
  const buckets: FutureDueBucket[] = [];
  for (let offset = 0; offset <= span; offset += 1) {
    buckets.push({ day: addDays(today, offset), offset, reviews: byOffset.get(offset) ?? 0 });
  }

  const total = [...byOffset.values()].reduce((sum, value) => sum + value, 0);
  const daysWithReviews = [...byOffset.values()].filter((value) => value > 0).length;
  const busiestDay = buckets.reduce<FutureDueBucket | null>(
    (best, bucket) => (bucket.reviews > 0 && (!best || bucket.reviews > best.reviews) ? bucket : best),
    null,
  );

  return {
    buckets,
    total,
    backlog,
    beyondHorizon,
    horizonDays,
    daysWithReviews,
    busiestDay,
    // Sin nada programado no hay media que dar: es una pregunta sin respuesta, no un cero.
    averagePerDay: total > 0 ? round1(ratio(total, buckets.length)) : null,
  };
}

// ── Inventario del scheduler ─────────────────────────────────────────────────

export type SchedulerCountStats = {
  nuevas: number;
  aprendiendo: number;
  reaprendiendo: number;
  /** Repaso con intervalo menor de 21 días. */
  young: number;
  /** Repaso con intervalo de 21 días o más. */
  mature: number;
};

export function buildSchedulerCounts(cards: readonly Card[]): SchedulerCountStats {
  const counts: SchedulerCountStats = {
    nuevas: 0,
    aprendiendo: 0,
    reaprendiendo: 0,
    young: 0,
    mature: 0,
  };
  for (const { scheduling } of cards) {
    switch (scheduling.state) {
      case 'nueva':
        counts.nuevas += 1;
        break;
      case 'aprendiendo':
        counts.aprendiendo += 1;
        break;
      case 'reaprendiendo':
        counts.reaprendiendo += 1;
        break;
      case 'repaso':
        if (scheduling.scheduledDays >= MATURE_INTERVAL_DAYS) counts.mature += 1;
        else counts.young += 1;
        break;
    }
  }
  return counts;
}

/** Distribución de los intervalos reales de las cartas que están en repaso. */
export function buildReviewIntervals(cards: readonly Card[]): DistributionStats {
  const values = cards
    .filter((card) => card.scheduling.state === 'repaso' && card.scheduling.scheduledDays > 0)
    .map((card) => card.scheduling.scheduledDays);
  return distribute(values, intervalBuckets);
}

/**
 * Distribución de la estabilidad.
 *
 * Solo entran las cartas que de verdad tienen estado FSRS: una carta nueva no tiene
 * estabilidad, tiene un cero que significa "todavía nada". Contarla la mezclaría con las
 * cartas realmente frágiles y hundiría la mediana (docs/PRODUCT.md, 2026-08-30).
 */
export function buildStabilityStats(cards: readonly Card[]): DistributionStats {
  const values = cards
    .filter((card) => card.scheduling.reps > 0 && card.scheduling.stability > 0)
    .map((card) => card.scheduling.stability);
  return distribute(values, stabilityBuckets);
}

/**
 * Distribución de la dificultad.
 *
 * Difficulty es una propiedad de la carta que FSRS estima a partir de su historial: cuánto
 * cuesta mantenerla en memoria. **No es el botón Difícil**, que es una respuesta puntual de
 * una sola revisión. Pulsar Difícil muchas veces influye en la dificultad, pero ni son lo
 * mismo ni se miden igual.
 */
export function buildDifficultyStats(cards: readonly Card[]): DistributionStats {
  const values = cards
    .filter((card) => card.scheduling.reps > 0 && card.scheduling.difficulty > 0)
    .map((card) => card.scheduling.difficulty);
  return distribute(values, difficultyBuckets);
}

/**
 * Distribución de la probabilidad estimada de recordar, ahora mismo.
 *
 * Se calcula, no se guarda: depende del tiempo transcurrido, así que persistirla la
 * convertiría en una verdad histórica falsa en cuanto pasara un día
 * (docs/PRODUCT.md, 2026-08-30).
 */
export function buildRetrievabilityStats(
  cards: readonly Card[],
  scheduler: SpacedRepetitionScheduler,
  now: number,
): DistributionStats {
  const values: number[] = [];
  for (const card of cards) {
    if (card.scheduling.state !== 'repaso') continue;
    const retrievability = scheduler.getRetrievability(card.scheduling, now);
    if (retrievability === null) continue;
    values.push(Math.max(0, Math.min(100, retrievability * 100)));
  }
  return distribute(values, retrievabilityBuckets);
}

// ── Selección ────────────────────────────────────────────────────────────────

/** Revisiones del ámbito. El periodo lo aplica quien llama, con su propio rango. */
export function scopedReviews(
  reviews: readonly StudyReviewEvent[],
  scope: StatsScope,
): StudyReviewEvent[] {
  return reviews.filter((review) => matchesScope(review.deckId, scope));
}

export function rangedReviews(
  reviews: readonly StudyReviewEvent[],
  range: PeriodRange,
): StudyReviewEvent[] {
  return reviews.filter((review) => dayInRange(review.localDay, range));
}

