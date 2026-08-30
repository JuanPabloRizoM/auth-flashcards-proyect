import { createFsrsScheduler } from './fsrsAdapter';
import type { SpacedRepetitionScheduler } from './types';

/**
 * Repetición espaciada.
 *
 * Punto de entrada único de la feature. Lo que se exporta son tipos propios y una
 * abstracción; la librería de FSRS solo la conoce `fsrsAdapter.ts`.
 */

/**
 * El scheduler de la aplicación.
 *
 * Es una sola instancia porque no tiene estado: sus operaciones son funciones puras del
 * estado de la carta y del instante que se le pasa. Construirla en cada renderizado solo
 * gastaría tiempo en recalcular los mismos parámetros.
 */
export const appScheduler: SpacedRepetitionScheduler = createFsrsScheduler();

export {
  createFsrsScheduler,
  FSRS_SCHEDULER_ID,
  FSRS_SCHEDULER_VERSION,
  fsrsEmptyCardAt,
  initialScheduling,
  REQUEST_RETENTION,
} from './fsrsAdapter';
export type { FsrsSchedulerOptions } from './fsrsAdapter';
export { formatIntervalDays, formatSchedulingInterval } from './format';
export {
  isPassingRating,
  MATURE_INTERVAL_DAYS,
  newScheduling,
  reviewRatingHints,
  reviewRatingLabels,
  reviewRatings,
  schedulingStates,
} from './types';
export type {
  CardScheduling,
  ReviewRating,
  SchedulerIdentity,
  SchedulerParameters,
  SchedulingOutcome,
  SchedulingPreview,
  SchedulingState,
  SpacedRepetitionScheduler,
} from './types';
