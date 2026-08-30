/**
 * Tipos del historial de estudio y de las estadísticas.
 *
 * Sin dependencias de interfaz ni de almacenamiento: el motor de estadísticas es una
 * función pura sobre estos tipos (docs/ARCHITECTURE.md, reglas 1, 3 y 7).
 *
 * El historial es append-only y su identidad son los identificadores, no los nombres:
 * un evento sigue siendo atribuible a su mazo aunque el mazo se renombre o se elimine
 * después (docs/PRODUCT.md, 2026-08-23).
 */

import type { ReviewRating, SchedulingState } from '../scheduler/types';

/** De dónde salió una carta. Solo se conoce para las creadas desde que hay tracking. */
export type CardOrigin = 'manual' | 'csv' | 'xlsx' | 'markdown';

export const cardOrigins: readonly CardOrigin[] = ['manual', 'csv', 'xlsx', 'markdown'] as const;

/**
 * Una sesión de estudio.
 *
 * `activeMs` es tiempo activo, no tiempo transcurrido: no incluye lo que la pestaña o la
 * aplicación pasaron en segundo plano. Se construye como la suma de las duraciones activas
 * de sus cartas completadas, así que sesión y cartas nunca pueden discrepar.
 */
export type StudySession = {
  id: string;
  deckId: string;
  /** Instante de inicio, en milisegundos desde epoch. */
  startedAt: number;
  /** `null` mientras la sesión sigue abierta. */
  endedAt: number | null;
  activeMs: number;
  completedCards: number;
  /**
   * Día local en que empezó la sesión, congelado al registrarla.
   *
   * Se guarda en vez de recalcularse porque el día que le importa a la persona usuaria es
   * el suyo, el de cuando estudió. Recalcularlo después daría un día distinto al viajar,
   * al cambiar el horario de verano o al ejecutar los tests en otra zona horaria.
   */
  localDay: string;
};

/**
 * Una carta dentro de una sesión: se mostró, se reveló y se completó.
 *
 * Los tres instantes se guardan por separado para poder analizar después el tiempo de
 * lectura frente al de comprobación sin volver a registrar nada.
 */
export type StudyCardEvent = {
  id: string;
  sessionId: string;
  deckId: string;
  cardId: string;
  shownAt: number;
  /** `null` si nunca se llegó a revelar el reverso. */
  revealedAt: number | null;
  /** `null` si la carta se abandonó sin pasar a la siguiente. */
  completedAt: number | null;
  activeMs: number;
  /** Día local en que se completó la carta, congelado al registrarla. */
  localDay: string;
  /** Hora local 0..23 en que se completó la carta, congelada al registrarla. */
  localHour: number;
};

/**
 * Una calificación aplicada a una carta.
 *
 * Es el registro de auditoría de la repetición espaciada: guarda de dónde venía la carta y
 * a dónde fue, no solo el resultado. Con eso, una estadística puede clasificar la revisión
 * por el intervalo que la carta tenía **en ese momento** —que es lo que distingue Young de
 * Mature— sin depender del intervalo que tenga hoy.
 *
 * Es append-only: una revisión nunca se reescribe ni se borra, ni siquiera cuando se
 * elimina la carta o el mazo (docs/PRODUCT.md, 2026-08-23 y 2026-08-30).
 *
 * Solo existen registros desde TASK-007. La actividad anterior quedó en `StudyCardEvent`,
 * que no tiene calificación, y **no se convierte** en revisiones inventadas: las métricas
 * que dependen de la calificación la excluyen en vez de suponerla.
 */
export type StudyReviewEvent = {
  id: string;
  sessionId: string;
  deckId: string;
  cardId: string;
  /** Instante de la calificación, en milisegundos desde epoch. */
  reviewedAt: number;
  rating: ReviewRating;
  previousState: SchedulingState;
  newState: SchedulingState;
  /** Vencimiento que tenía la carta. `null` si era una carta nueva. */
  previousDue: number | null;
  newDue: number;
  /** Intervalo en días que la carta tenía al aparecer. 0 en aprendizaje y en cartas nuevas. */
  previousIntervalDays: number;
  /** Intervalo en días que el scheduler ha programado. */
  newIntervalDays: number;
  /** Días transcurridos desde la revisión anterior, según el scheduler. */
  elapsedDays: number;
  /** Estabilidad resultante, en días. */
  stability: number;
  /** Dificultad resultante, entre 1 y 10. */
  difficulty: number;
  /** Tiempo activo dedicado a esta carta antes de calificarla. */
  durationMs: number;
  schedulerId: string;
  schedulerVersion: string;
  /** Día local de la calificación, congelado al registrarla. */
  localDay: string;
  /** Hora local 0..23 de la calificación, congelada al registrarla. */
  localHour: number;
};

/** El alta de una carta. Solo existe para las creadas desde que hay tracking. */
export type CardAddedEvent = {
  id: string;
  deckId: string;
  cardId: string;
  addedAt: number;
  origin: CardOrigin;
  localDay: string;
};

/**
 * Último nombre conocido de un mazo.
 *
 * Permite nombrar un mazo en una vista histórica después de eliminarlo. Nunca es la
 * identidad: la identidad es `deckId`. Renombrar actualiza este snapshot y no crea un
 * historial nuevo.
 */
export type DeckSnapshot = {
  deckId: string;
  name: string;
  lastSeenAt: number;
};

/** El historial completo, tal y como lo entrega el repositorio. */
export type StudyHistory = {
  /**
   * Instante en que se activó el tracking en este dispositivo.
   *
   * `null` significa que todavía no se ha activado. No hay historial anterior y no se
   * fabrica ninguno: lo que existiera antes es baseline sin fecha.
   */
  trackedSince: number | null;
  sessions: StudySession[];
  cardEvents: StudyCardEvent[];
  cardAdditions: CardAddedEvent[];
  /** Calificaciones. Vacío en un historial anterior a TASK-007. */
  reviews: StudyReviewEvent[];
  deckSnapshots: DeckSnapshot[];
  /**
   * Instante de la primera calificación registrada en este dispositivo.
   *
   * Marca desde cuándo existen datos de calificación. `null` mientras no se haya calificado
   * nada: es lo que permite decir "datos de calificación disponibles desde…" en vez de
   * enseñar una gráfica vacía como si significara cero (docs/PRODUCT.md, 2026-08-30).
   */
  ratedSince: number | null;
};

export const emptyHistory: StudyHistory = {
  trackedSince: null,
  sessions: [],
  cardEvents: [],
  cardAdditions: [],
  reviews: [],
  deckSnapshots: [],
  ratedSince: null,
};

/** Ámbito de la consulta: toda la actividad o la de un solo mazo. */
export type StatsScope = { kind: 'all' } | { kind: 'deck'; deckId: string };

export type StatsPeriod = '1m' | '3m' | '1y' | 'all';

export const statsPeriods: readonly StatsPeriod[] = ['1m', '3m', '1y', 'all'] as const;

/**
 * Una consulta al motor.
 *
 * `today` es la clave de día local de hoy y se inyecta en vez de leerse del reloj: es lo
 * que permite que un test afirme sobre fronteras de fecha concretas en lugar de sobre
 * "más o menos hoy", y lo que hace que el resultado no dependa de la zona horaria en la
 * que se ejecute.
 *
 * `now` es el mismo instante, en milisegundos. Hace falta aparte de `today` porque la
 * retrievability y el vencimiento no se miden en días de calendario sino en el momento
 * exacto: una carta que vence dentro de tres horas vence hoy y todavía no está disponible.
 */
export type StatsQuery = {
  scope: StatsScope;
  period: StatsPeriod;
  today: string;
  now: number;
};
