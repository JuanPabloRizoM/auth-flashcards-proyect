/**
 * Tipos de la repetición espaciada.
 *
 * Son tipos propios, no los de la librería de FSRS. La aplicación habla en español y en
 * milisegundos desde epoch, igual que el resto del dominio; la traducción a la
 * representación de la librería vive en un único adaptador (docs/ARCHITECTURE.md, regla 3).
 * Gracias a eso, cambiar de versión de FSRS —o de implementación— no obliga a tocar ni las
 * pantallas ni el historial ni las estadísticas.
 */

/**
 * Estado de una carta para el scheduler.
 *
 * - `nueva`: nunca se ha calificado.
 * - `aprendiendo`: está pasando por los primeros pasos de aprendizaje.
 * - `repaso`: ya se aprendió y vuelve cada cierto número de días.
 * - `reaprendiendo`: se falló una carta que estaba en repaso y vuelve a los pasos cortos.
 */
export type SchedulingState = 'nueva' | 'aprendiendo' | 'repaso' | 'reaprendiendo';

export const schedulingStates: readonly SchedulingState[] = [
  'nueva',
  'aprendiendo',
  'repaso',
  'reaprendiendo',
] as const;

/**
 * Calificación de una respuesta.
 *
 * Cuatro opciones confirmadas por el usuario (docs/PRODUCT.md, 2026-08-30). `dificil` es
 * aprobatoria: significa que se recordó, con esfuerzo. El único fallo es `otra-vez`.
 */
export type ReviewRating = 'otra-vez' | 'dificil' | 'bien' | 'facil';

export const reviewRatings: readonly ReviewRating[] = [
  'otra-vez',
  'dificil',
  'bien',
  'facil',
] as const;

export const reviewRatingLabels: Record<ReviewRating, string> = {
  'otra-vez': 'Otra vez',
  dificil: 'Difícil',
  bien: 'Bien',
  facil: 'Fácil',
};

/** Qué significa cada botón. Ayuda corta, para una línea bajo la etiqueta. */
export const reviewRatingHints: Record<ReviewRating, string> = {
  'otra-vez': 'No la recordaste',
  dificil: 'La recordaste con dificultad',
  bien: 'La recordaste con esfuerzo normal',
  facil: 'La recordaste sin esfuerzo',
};

/**
 * ¿Esta calificación cuenta como acierto?
 *
 * Existe como función y no como comparación suelta para que no pueda escribirse en dos
 * sitios con dos criterios distintos. Difícil es acierto: quien lo trate como fallo estará
 * contradiciendo una decisión de producto, y hay un test dedicado a impedirlo.
 */
export function isPassingRating(rating: ReviewRating): boolean {
  return rating !== 'otra-vez';
}

/**
 * Estado de scheduling persistido de una carta.
 *
 * Campos mínimos que la implementación FSRS necesita para reproducir su cálculo, más los
 * contadores que las estadísticas presentan. No hay campos redundantes: todo lo que está
 * aquí lo lee alguien.
 */
export type CardScheduling = {
  state: SchedulingState;
  /**
   * Instante de la próxima aparición, en milisegundos desde epoch.
   *
   * `null` solo en las cartas `nueva`: nunca se han calificado y no tienen una fecha real
   * de revisión. Se representa como ausencia y no como "ahora" para no fabricar un dato:
   * una carta nueva está disponible siempre, pero no está *programada* para hoy, y Future
   * Due no debe contarla (docs/PRODUCT.md, 2026-08-30).
   */
  due: number | null;
  /** Instante de la última calificación. `null` si nunca se calificó. */
  lastReview: number | null;
  /** Estabilidad de FSRS, en días. 0 mientras la carta es nueva. */
  stability: number;
  /** Dificultad de FSRS, entre 1 y 10. 0 mientras la carta es nueva. */
  difficulty: number;
  /** Días transcurridos entre la penúltima y la última calificación. */
  elapsedDays: number;
  /** Días que el scheduler programó en la última calificación. */
  scheduledDays: number;
  /** Paso de aprendizaje en el que está la carta. Lo necesita FSRS-6 para los pasos cortos. */
  learningSteps: number;
  /** Calificaciones acumuladas. */
  reps: number;
  /** Veces que se falló una carta ya aprendida. */
  lapses: number;
};

/** Estado de una carta que todavía no se ha calificado nunca. */
export const newScheduling: CardScheduling = Object.freeze({
  state: 'nueva',
  due: null,
  lastReview: null,
  stability: 0,
  difficulty: 0,
  elapsedDays: 0,
  scheduledDays: 0,
  learningSteps: 0,
  reps: 0,
  lapses: 0,
});

/** Intervalo a partir del cual una carta de repaso se considera madura. */
export const MATURE_INTERVAL_DAYS = 21;

/** El resultado de calificar: el estado nuevo y cuánto falta para volver a verla. */
export type SchedulingOutcome = {
  rating: ReviewRating;
  scheduling: CardScheduling;
  /** Milisegundos desde el instante de la calificación hasta el vencimiento nuevo. */
  intervalMs: number;
};

/** Las cuatro consecuencias posibles de calificar ahora mismo. */
export type SchedulingPreview = Record<ReviewRating, SchedulingOutcome>;

/** Parámetros con los que trabaja el scheduler, para poder auditarlos y migrarlos. */
export type SchedulerParameters = {
  requestRetention: number;
  maximumIntervalDays: number;
  learningSteps: readonly string[];
  relearningSteps: readonly string[];
  enableFuzz: boolean;
  enableShortTerm: boolean;
  /** Pesos del modelo. Se guardan enteros para poder detectar un cambio de versión. */
  weights: readonly number[];
};

/**
 * Identidad del scheduler que produjo un resultado.
 *
 * Se persiste con cada revisión y con la biblioteca. Sin esto, una actualización futura de
 * FSRS dejaría el historial sin forma de saber con qué reglas se programó cada carta.
 */
export type SchedulerIdentity = {
  /** Qué algoritmo. Hoy solo existe `fsrs`. */
  id: string;
  /** Versión concreta, incluida la de la librería. */
  version: string;
};

/**
 * El contrato que ve el resto de la aplicación.
 *
 * Ni las pantallas ni el motor de estadísticas conocen la librería que hay debajo: hablan
 * con esto.
 */
export type SpacedRepetitionScheduler = SchedulerIdentity & {
  parameters: SchedulerParameters;
  /** Las cuatro consecuencias de calificar en `now`. No modifica la carta. */
  preview: (scheduling: CardScheduling, now: number) => SchedulingPreview;
  /** Aplica una calificación en `now` y devuelve el estado siguiente. */
  rate: (scheduling: CardScheduling, rating: ReviewRating, now: number) => SchedulingOutcome;
  /**
   * Probabilidad estimada de recordar la carta en `now`, entre 0 y 1.
   *
   * `null` cuando la carta todavía no tiene historial suficiente: una carta nueva no tiene
   * una probabilidad de recuerdo, tiene una pregunta sin responder.
   */
  getRetrievability: (scheduling: CardScheduling, now: number) => number | null;
  /** ¿Toca verla ya? Las cartas nuevas están siempre disponibles. */
  isDue: (scheduling: CardScheduling, now: number) => boolean;
};
