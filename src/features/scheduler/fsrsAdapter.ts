import {
  createEmptyCard,
  FSRSVersion,
  fsrs,
  generatorParameters,
  Rating,
  State,
  type Card as FsrsCard,
  type FSRSParameters,
  type Grade,
} from 'ts-fsrs';

import {
  newScheduling,
  reviewRatings,
  type CardScheduling,
  type ReviewRating,
  type SchedulerParameters,
  type SchedulingOutcome,
  type SchedulingPreview,
  type SchedulingState,
  type SpacedRepetitionScheduler,
} from './types';

/**
 * Adaptador de FSRS.
 *
 * **Este es el único archivo del proyecto que importa `ts-fsrs`.** Todo lo demás —pantallas,
 * cola de estudio, historial, motor de estadísticas y PDF— habla con
 * `SpacedRepetitionScheduler`, que está definido en tipos propios. Así, actualizar la
 * librería o sustituirla se reduce a reescribir este archivo, y los tipos externos no se
 * esparcen por la aplicación (docs/ARCHITECTURE.md, regla 3).
 *
 * ## Por qué ts-fsrs
 *
 * - Implementación mantenida del algoritmo FSRS, en TypeScript, publicada por el mismo
 *   grupo que desarrolla el algoritmo (open-spaced-repetition). La versión instalada la
 *   declara la propia librería y se persiste con cada revisión; ver `FSRS_SCHEDULER_VERSION`.
 * - Licencia MIT.
 * - Sin dependencias en tiempo de ejecución, y sin APIs exclusivas de Node: no referencia
 *   `process`, `Buffer`, `__dirname` ni módulos `node:`. Funciona igual en el bundler de
 *   Expo (web y nativo) y bajo Jest.
 * - Publica ESM, CommonJS y tipos, así que Metro y Jest resuelven cada uno el suyo.
 *
 * No se escriben las fórmulas a mano ni se sustituye FSRS por SM-2: es una decisión de
 * producto confirmada (docs/PRODUCT.md, 2026-08-30).
 *
 * ## Determinismo
 *
 * `enable_fuzz` es `false`, que además es el valor por defecto de la librería. Sin fuzz, el
 * intervalo que muestra un botón antes de pulsarlo es exactamente el que se aplica al
 * pulsarlo, y los tests golden pueden comparar contra valores fijos. Es también la razón de
 * que no haga falta controlar ningún generador aleatorio.
 */

/** Identificador estable del algoritmo. */
export const FSRS_SCHEDULER_ID = 'fsrs';

/**
 * Versión que se persiste con cada revisión y con la biblioteca.
 *
 * Sale de la propia librería (`FSRSVersion`, hoy `v5.4.1 using FSRS-6.0`) y no de un literal:
 * el rango de `package.json` permite instalar una versión menor más alta, y una cadena
 * escrita a mano dejaría en disco una versión falsa para siempre.
 */
export const FSRS_SCHEDULER_VERSION = `ts-fsrs ${FSRSVersion}`;

/**
 * Retención objetivo.
 *
 * 0,90 confirmado por el usuario, que además coincide con el valor por defecto de la
 * librería. No hay interfaz para cambiarlo en esta versión.
 */
export const REQUEST_RETENTION = 0.9;

const ratingToGrade: Record<ReviewRating, Grade> = {
  'otra-vez': Rating.Again,
  dificil: Rating.Hard,
  bien: Rating.Good,
  facil: Rating.Easy,
};

const stateFromFsrs: Record<State, SchedulingState> = {
  [State.New]: 'nueva',
  [State.Learning]: 'aprendiendo',
  [State.Review]: 'repaso',
  [State.Relearning]: 'reaprendiendo',
};

const stateToFsrs: Record<SchedulingState, State> = {
  nueva: State.New,
  aprendiendo: State.Learning,
  repaso: State.Review,
  reaprendiendo: State.Relearning,
};

/**
 * Convierte el estado propio en la carta que entiende la librería.
 *
 * Una carta `nueva` no tiene vencimiento propio, así que se le da `now`: para FSRS una
 * carta nueva se califica en el instante en que se ve, y es exactamente lo que ocurre.
 */
function toFsrsCard(scheduling: CardScheduling, now: number): FsrsCard {
  const card: FsrsCard = {
    due: new Date(scheduling.due ?? now),
    stability: scheduling.stability,
    difficulty: scheduling.difficulty,
    elapsed_days: scheduling.elapsedDays,
    scheduled_days: scheduling.scheduledDays,
    learning_steps: scheduling.learningSteps,
    reps: scheduling.reps,
    lapses: scheduling.lapses,
    state: stateToFsrs[scheduling.state],
  };
  if (scheduling.lastReview !== null) {
    card.last_review = new Date(scheduling.lastReview);
  }
  return card;
}

function fromFsrsCard(card: FsrsCard): CardScheduling {
  return {
    state: stateFromFsrs[card.state],
    due: card.due.getTime(),
    lastReview: card.last_review ? card.last_review.getTime() : null,
    stability: card.stability,
    difficulty: card.difficulty,
    elapsedDays: card.elapsed_days,
    scheduledDays: card.scheduled_days,
    learningSteps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
  };
}

function describeParameters(params: FSRSParameters): SchedulerParameters {
  return {
    requestRetention: params.request_retention,
    maximumIntervalDays: params.maximum_interval,
    learningSteps: [...params.learning_steps],
    relearningSteps: [...params.relearning_steps],
    enableFuzz: params.enable_fuzz,
    enableShortTerm: params.enable_short_term,
    weights: [...params.w],
  };
}

export type FsrsSchedulerOptions = {
  /** Retención objetivo. Solo se expone para los tests golden; la aplicación usa 0,90. */
  requestRetention?: number;
};

/**
 * Construye el scheduler.
 *
 * Todo lo que no se fija aquí explícitamente son los valores por defecto de la librería. No
 * se copian parámetros optimizados de terceros: los pesos que se usan son los que la propia
 * implementación declara como punto de partida, y quedan registrados en la metadata
 * persistida para que un cambio futuro sea visible.
 */
export function createFsrsScheduler(
  options: FsrsSchedulerOptions = {},
): SpacedRepetitionScheduler {
  const params = generatorParameters({
    request_retention: options.requestRetention ?? REQUEST_RETENTION,
    enable_fuzz: false,
  });
  const engine = fsrs(params);
  const parameters = describeParameters(params);

  const outcomeOf = (card: FsrsCard, rating: ReviewRating, now: number): SchedulingOutcome => {
    const scheduling = fromFsrsCard(card);
    return {
      rating,
      scheduling,
      intervalMs: Math.max(0, (scheduling.due ?? now) - now),
    };
  };

  return {
    id: FSRS_SCHEDULER_ID,
    version: FSRS_SCHEDULER_VERSION,
    parameters,

    preview(scheduling: CardScheduling, now: number): SchedulingPreview {
      // `repeat` construye su propia copia de la carta: la entrada no se toca, y hay un test
      // que lo comprueba comparando el objeto en profundidad antes y después.
      const record = engine.repeat(toFsrsCard(scheduling, now), new Date(now));
      const preview = {} as SchedulingPreview;
      for (const rating of reviewRatings) {
        preview[rating] = outcomeOf(record[ratingToGrade[rating]].card, rating, now);
      }
      return preview;
    },

    rate(scheduling: CardScheduling, rating: ReviewRating, now: number): SchedulingOutcome {
      const record = engine.next(toFsrsCard(scheduling, now), new Date(now), ratingToGrade[rating]);
      return outcomeOf(record.card, rating, now);
    },

    getRetrievability(scheduling: CardScheduling, now: number): number | null {
      // Sin una calificación previa no hay curva de olvido que evaluar. Devolver 0, o 1,
      // sería afirmar algo que no se sabe.
      if (scheduling.lastReview === null || scheduling.stability <= 0) {
        return null;
      }
      return engine.get_retrievability(toFsrsCard(scheduling, now), new Date(now), false);
    },

    isDue(scheduling: CardScheduling, now: number): boolean {
      // Una carta nueva está siempre disponible: no tiene fecha, tiene turno.
      if (scheduling.due === null) return true;
      return scheduling.due <= now;
    },
  };
}

/** Estado inicial de una carta recién creada o migrada. */
export function initialScheduling(): CardScheduling {
  return { ...newScheduling };
}

/**
 * Comprobación de que el estado vacío propio y el de la librería significan lo mismo.
 *
 * Se usa en los tests: si una versión futura de FSRS cambiara la representación de una
 * carta nueva, esto lo haría visible en vez de dejar que se descubriera en producción.
 */
export function fsrsEmptyCardAt(now: number): CardScheduling {
  return fromFsrsCard(createEmptyCard(new Date(now)));
}
