import { appScheduler } from '../scheduler';
import type { SpacedRepetitionScheduler } from '../scheduler/types';

import type { Library } from '../../types/domain';

import {
  buildAnswerButtons,
  countUnratedEvents,
  buildDifficultyStats,
  buildFutureDue,
  buildReviewIntervals,
  buildSchedulerCounts,
  buildStabilityStats,
  buildRetrievabilityStats,
  buildTrueRetention,
  rangedReviews,
  scopedReviews,
  type AnswerButtonsStats,
  type DistributionStats,
  type FutureDueStats,
  type SchedulerCountStats,
  type TrueRetentionStats,
} from './fsrs';
import {
  addDays,
  dayInRange,
  daysBetween,
  enumerateDays,
  periodLabels,
  periodRange,
  type PeriodRange,
} from './time';
import {
  cardOrigins,
  type CardOrigin,
  type DeckSnapshot,
  type StatsQuery,
  type StatsScope,
  type StudyCardEvent,
  type StudyHistory,
} from './types';

/**
 * Motor de estadísticas.
 *
 * Una única función pura de (biblioteca, historial, consulta) a informe. No conoce React,
 * no lee el reloj y no toca almacenamiento, así que se puede probar con datasets de
 * resultados comprobables a mano (docs/ARCHITECTURE.md, reglas 1 y 3).
 *
 * Dashboard y PDF consumen exactamente el mismo informe: las fórmulas viven aquí y solo
 * aquí, de modo que no puedan divergir.
 *
 * Convenios que atraviesan todo el motor:
 *
 * - **La unidad de "estudiada" es la carta completada.** Una carta que se mostró pero se
 *   abandonó sin pasar a la siguiente no cuenta ni en tarjetas ni en tiempo. Así el total
 *   de actividad, el de tiempo y el de velocidad son siempre coherentes entre sí.
 * - **Lo desconocido es `null`, nunca `0`.** Un promedio sin muestras no es cero: es una
 *   pregunta sin respuesta, y la pantalla debe poder distinguirlo.
 * - **El periodo filtra la actividad, no el inventario.** El conteo de tarjetas y el
 *   origen describen el estado actual de la biblioteca, que no tiene un "hace tres meses".
 */

export type DayPoint = { day: string; value: number };

export type TodayStats = {
  studied: number;
  unique: number;
  activeMs: number;
  secondsPerCard: number | null;
  sessions: number;
  /** Solo tiene sentido en ámbito global. En el de un mazo es `null`, no 1. */
  decksStudied: number | null;
};

export type ActivityStats = {
  series: DayPoint[];
  total: number;
  /** Cartas distintas repasadas en el periodo. Repasar la misma dos veces cuenta una. */
  uniqueCards: number;
  daysStudied: number;
  daysInPeriod: number;
  averageOverPeriod: number | null;
  averageForDaysStudied: number | null;
};

export type CalendarLevel = 0 | 1 | 2 | 3 | 4;

export type CalendarDay = {
  day: string;
  cards: number;
  activeMs: number;
  sessions: number;
  level: CalendarLevel;
};

export type CalendarStats = {
  days: CalendarDay[];
  maxCards: number;
  fromDay: string;
  toDay: string;
};

export type TimeStats = {
  series: DayPoint[];
  totalMs: number;
  averagePerActiveDayMs: number | null;
  averageSessionMs: number | null;
  longestSessionMs: number | null;
  sessions: number;
};

export type SpeedStats = {
  /** Solo días con al menos una carta completada: los demás no tienen velocidad. */
  series: DayPoint[];
  averageSeconds: number | null;
  fastestDaySeconds: number | null;
  slowestDaySeconds: number | null;
};

export type StreakStats = {
  current: number;
  best: number;
  daysStudied: number;
};

export type HourPoint = { hour: number; cards: number };

export type HourlyStats = {
  /** Siempre las 24 horas, para que la gráfica tenga eje completo. */
  hours: HourPoint[];
  busiestHour: number | null;
  total: number;
};

export type CardCountStats = {
  total: number;
  neverStudied: number;
  studiedAtLeastOnce: number;
  studiedToday: number;
  /** Reparto por estado del scheduler. Suma exactamente `total`. */
  scheduler: SchedulerCountStats;
};

export type AddedStats = {
  series: DayPoint[];
  totalInPeriod: number;
  /** Cartas que ya existían cuando se activó el tracking: no tienen fecha de alta. */
  baseline: number;
  trackedSince: number | null;
};

export type OriginKey = CardOrigin | 'desconocido';

export type OriginSlice = {
  origin: OriginKey;
  cards: number;
  /** 0..100. Es 0 solo cuando de verdad no hay cartas de ese origen. */
  percent: number;
};

export type OriginStats = {
  slices: OriginSlice[];
  total: number;
  known: number;
  unknown: number;
};

export type DeckComparisonRow = {
  deckId: string;
  name: string;
  /** El mazo ya no está en la biblioteca, pero su historial sigue contando. */
  deleted: boolean;
  studied: number;
  activeMs: number;
  sessions: number;
  secondsPerCard: number | null;
};

/** Una métrica de Anki que todavía no puede calcularse, y por qué. */
export type DeferredMetric = { anki: string; reason: string };

export type StatsReport = {
  scope: StatsScope;
  scopeLabel: string;
  /** El ámbito es un mazo que ya no existe en la biblioteca. */
  scopeDeleted: boolean;
  period: StatsQuery['period'];
  periodLabel: string;
  range: PeriodRange;
  today: string;
  trackedSince: number | null;
  /** No hay ni un solo evento en el ámbito y periodo consultados. */
  empty: boolean;
  todayStats: TodayStats;
  activity: ActivityStats;
  calendar: CalendarStats;
  time: TimeStats;
  speed: SpeedStats;
  streak: StreakStats;
  hourly: HourlyStats;
  counts: CardCountStats;
  added: AddedStats;
  origin: OriginStats;
  /** `null` cuando el ámbito es un solo mazo: comparar un mazo consigo mismo no informa. */
  deckComparison: DeckComparisonRow[] | null;
  /** Cuándo se registró la primera calificación. `null` si todavía no hay ninguna. */
  ratedSince: number | null;
  answerButtons: AnswerButtonsStats;
  trueRetention: TrueRetentionStats;
  futureDue: FutureDueStats;
  reviewIntervals: DistributionStats;
  stability: DistributionStats;
  difficulty: DistributionStats;
  retrievability: DistributionStats;
  deferred: DeferredMetric[];
};

export type StatsInput = {
  library: Library;
  history: StudyHistory;
  /**
   * Scheduler con el que se derivan las métricas que dependen del algoritmo.
   *
   * Se inyecta para que un test pueda usar otro y para que el motor siga sin conocer la
   * librería que hay debajo. Por defecto, el de la aplicación.
   */
  scheduler?: SpacedRepetitionScheduler;
};

/**
 * Métricas del PDF de Anki que esta versión no puede calcular.
 *
 * Se declaran explícitamente en vez de omitirse en silencio o dibujarse a cero: un cero
 * sería una afirmación falsa sobre datos que no existen (docs/PRODUCT.md, 2026-08-23).
 */
export const deferredMetrics: readonly DeferredMetric[] = [
  {
    anki: 'Card Ease',
    // El texto es corto a propósito: es una celda de tabla, y el PDF la recorta al ancho de
    // su columna. Lo importante —que el sustituto es Difficulty— tiene que caber.
    reason:
      'FSRS no usa Ease: su equivalente es Difficulty, que sí se muestra. El Ease es propio de SM-2.',
  },
] as const;

function matchesScope(deckId: string, scope: StatsScope): boolean {
  return scope.kind === 'all' || scope.deckId === deckId;
}

/** Una carta cuenta cuando se completó. Ver el convenio del encabezado. */
function isCompleted(event: StudyCardEvent): boolean {
  return event.completedAt !== null;
}

/** División que devuelve `null` en vez de `NaN` o `Infinity` cuando no hay divisor. */
function ratio(numerator: number, denominator: number): number | null {
  return denominator > 0 ? numerator / denominator : null;
}

/** Redondeo a un decimal, para que los segundos por tarjeta no arrastren binario. */
function round1(value: number | null): number | null {
  return value === null ? null : Math.round(value * 10) / 10;
}

function resolveDeckName(
  deckId: string,
  library: Library,
  snapshots: readonly DeckSnapshot[],
): { name: string; deleted: boolean } {
  const current = library.decks.find((deck) => deck.id === deckId);
  if (current) {
    return { name: current.name, deleted: false };
  }
  // El mazo ya no está: se recurre al último nombre conocido, y se dice que está eliminado.
  // Nunca se presenta como si siguiera en la biblioteca (docs/PRODUCT.md, 2026-08-23).
  const snapshot = snapshots.find((entry) => entry.deckId === deckId);
  return { name: snapshot?.name ?? 'Mazo eliminado', deleted: true };
}

/** Suma por día, con una entrada por cada día del rango aunque valga cero. */
function densify(totals: Map<string, number>, days: readonly string[]): DayPoint[] {
  return days.map((day) => ({ day, value: totals.get(day) ?? 0 }));
}

/**
 * Rango que cubre el calendario y las series diarias.
 *
 * En los periodos acotados es la ventana del periodo. En "todo el historial" no hay
 * frontera inferior, así que se empieza en el primer día con actividad; si no hay
 * ninguna, el rango se reduce a hoy y las gráficas muestran su estado vacío.
 */
function seriesRange(range: PeriodRange, earliestDay: string | null, today: string): string[] {
  const from = range.fromDay ?? earliestDay ?? today;
  // Un evento puede ser posterior a "hoy" solo si el reloj del dispositivo cambió; el
  // rango nunca se extiende más allá de hoy para no dibujar días futuros vacíos.
  return enumerateDays(from > today ? today : from, today);
}

function levelFor(cards: number, maxCards: number): CalendarLevel {
  if (cards <= 0 || maxCards <= 0) return 0;
  // Cuatro tramos proporcionales al día más activo del rango. Con el máximo siempre en 4,
  // el mapa se lee igual tanto si el pico son 8 tarjetas como si son 800.
  const level = Math.ceil((cards / maxCards) * 4);
  return Math.min(4, Math.max(1, level)) as CalendarLevel;
}

function buildStreak(studiedDays: ReadonlySet<string>, today: string): StreakStats {
  const daysStudied = studiedDays.size;
  if (daysStudied === 0) {
    return { current: 0, best: 0, daysStudied: 0 };
  }

  // La racha sigue viva mientras no se pierda un día entero: si hoy todavía no se ha
  // estudiado pero ayer sí, se cuenta desde ayer. Perder ayer y hoy la rompe.
  let cursor = studiedDays.has(today) ? today : addDays(today, -1);
  let current = 0;
  while (studiedDays.has(cursor)) {
    current += 1;
    cursor = addDays(cursor, -1);
  }

  const ordered = [...studiedDays].sort();
  let best = 0;
  let run = 0;
  let previous: string | null = null;
  for (const day of ordered) {
    run = previous !== null && daysBetween(previous, day) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    previous = day;
  }

  return { current, best, daysStudied };
}

export function buildStatsReport(input: StatsInput, query: StatsQuery): StatsReport {
  const { library, history, scheduler = appScheduler } = input;
  const { scope, period, today, now } = query;
  const range = periodRange(period, today);

  // ── Selección ────────────────────────────────────────────────────────────────
  // Un solo filtrado por ámbito y periodo alimenta todas las secciones. Es lo que
  // garantiza que no pueda haber leakage en una sección y no en otra.
  const scopedEvents = history.cardEvents.filter(
    (event) => isCompleted(event) && matchesScope(event.deckId, scope),
  );
  const rangedEvents = scopedEvents.filter((event) => dayInRange(event.localDay, range));

  const scopedSessions = history.sessions.filter((session) => matchesScope(session.deckId, scope));
  const rangedSessions = scopedSessions.filter((session) => dayInRange(session.localDay, range));

  const scopedAdditions = history.cardAdditions.filter((added) =>
    matchesScope(added.deckId, scope),
  );
  const rangedAdditions = scopedAdditions.filter((added) => dayInRange(added.localDay, range));

  const scopedCards = library.cards.filter((card) => matchesScope(card.deckId, scope));

  // El primer día con algo que contar. Incluye las altas y no solo los repasos: un periodo
  // en el que se añadieron tarjetas pero todavía no se estudió sigue teniendo historia que
  // dibujar, y sin esto la gráfica de añadidas se quedaría en blanco.
  const earliestDay = [...scopedEvents, ...scopedAdditions].reduce<string | null>(
    (earliest, entry) => (earliest === null || entry.localDay < earliest ? entry.localDay : earliest),
    null,
  );
  const days = seriesRange(range, earliestDay, today);

  // ── Agregados por día ────────────────────────────────────────────────────────
  const cardsByDay = new Map<string, number>();
  const timeByDay = new Map<string, number>();
  const sessionsByDay = new Map<string, number>();
  const addedByDay = new Map<string, number>();
  const hourTotals = new Array<number>(24).fill(0);

  for (const event of rangedEvents) {
    cardsByDay.set(event.localDay, (cardsByDay.get(event.localDay) ?? 0) + 1);
    timeByDay.set(event.localDay, (timeByDay.get(event.localDay) ?? 0) + event.activeMs);
    const hour = event.localHour;
    if (Number.isInteger(hour) && hour >= 0 && hour < 24) {
      hourTotals[hour] = (hourTotals[hour] ?? 0) + 1;
    }
  }
  for (const session of rangedSessions) {
    sessionsByDay.set(session.localDay, (sessionsByDay.get(session.localDay) ?? 0) + 1);
  }
  for (const added of rangedAdditions) {
    addedByDay.set(added.localDay, (addedByDay.get(added.localDay) ?? 0) + 1);
  }

  const totalCards = rangedEvents.length;
  const totalMs = rangedEvents.reduce((sum, event) => sum + event.activeMs, 0);
  const studiedDays = new Set(cardsByDay.keys());

  // ── Hoy ──────────────────────────────────────────────────────────────────────
  // Se calcula sobre el ámbito completo y no sobre el periodo: "hoy" es hoy tanto si se
  // está mirando el último mes como todo el historial.
  const todayEvents = scopedEvents.filter((event) => event.localDay === today);
  const todayMs = todayEvents.reduce((sum, event) => sum + event.activeMs, 0);
  const todayStats: TodayStats = {
    studied: todayEvents.length,
    unique: new Set(todayEvents.map((event) => event.cardId)).size,
    activeMs: todayMs,
    secondsPerCard: round1(ratio(todayMs / 1000, todayEvents.length)),
    sessions: scopedSessions.filter((session) => session.localDay === today).length,
    decksStudied:
      scope.kind === 'all' ? new Set(todayEvents.map((event) => event.deckId)).size : null,
  };

  // ── Actividad ────────────────────────────────────────────────────────────────
  // El divisor del promedio sobre el periodo son los días que el periodo cubre de verdad:
  // en "todo el historial" no son 365 fijos, sino los días transcurridos desde el primero
  // con actividad. Dividir por una ventana que nadie vivió daría un promedio inventado.
  const daysInPeriod = range.days ?? (rangedEvents.length === 0 ? 0 : days.length);
  const activity: ActivityStats = {
    series: densify(cardsByDay, days),
    total: totalCards,
    uniqueCards: new Set(rangedEvents.map((event) => event.cardId)).size,
    daysStudied: studiedDays.size,
    daysInPeriod,
    averageOverPeriod: round1(ratio(totalCards, daysInPeriod)),
    averageForDaysStudied: round1(ratio(totalCards, studiedDays.size)),
  };

  // ── Calendario ───────────────────────────────────────────────────────────────
  const maxCards = days.reduce((max, day) => Math.max(max, cardsByDay.get(day) ?? 0), 0);
  const calendar: CalendarStats = {
    days: days.map((day) => {
      const cards = cardsByDay.get(day) ?? 0;
      return {
        day,
        cards,
        activeMs: timeByDay.get(day) ?? 0,
        sessions: sessionsByDay.get(day) ?? 0,
        level: levelFor(cards, maxCards),
      };
    }),
    maxCards,
    fromDay: days[0] ?? today,
    toDay: days[days.length - 1] ?? today,
  };

  // ── Tiempo ───────────────────────────────────────────────────────────────────
  // Solo las sesiones cerradas entran en la media y en la más larga: una sesión abierta
  // todavía no tiene duración final y contarla la subestimaría.
  const closedSessions = rangedSessions.filter((session) => session.endedAt !== null);
  const closedMs = closedSessions.reduce((sum, session) => sum + session.activeMs, 0);
  const time: TimeStats = {
    series: densify(timeByDay, days),
    totalMs,
    averagePerActiveDayMs: ratio(totalMs, studiedDays.size),
    averageSessionMs: ratio(closedMs, closedSessions.length),
    longestSessionMs: closedSessions.length
      ? closedSessions.reduce((max, session) => Math.max(max, session.activeMs), 0)
      : null,
    sessions: rangedSessions.length,
  };

  // ── Velocidad ────────────────────────────────────────────────────────────────
  const speedSeries: DayPoint[] = [];
  for (const day of days) {
    const cards = cardsByDay.get(day) ?? 0;
    if (cards === 0) continue; // Un día sin tarjetas no tiene velocidad, y 0 s/tarjeta mentiría.
    const seconds = round1((timeByDay.get(day) ?? 0) / 1000 / cards);
    if (seconds !== null) speedSeries.push({ day, value: seconds });
  }
  const speed: SpeedStats = {
    series: speedSeries,
    averageSeconds: round1(ratio(totalMs / 1000, totalCards)),
    fastestDaySeconds: speedSeries.length
      ? speedSeries.reduce((min, point) => Math.min(min, point.value), Infinity)
      : null,
    slowestDaySeconds: speedSeries.length
      ? speedSeries.reduce((max, point) => Math.max(max, point.value), 0)
      : null,
  };

  // ── Racha ────────────────────────────────────────────────────────────────────
  const streak = buildStreak(studiedDays, today);

  // ── Actividad por hora ───────────────────────────────────────────────────────
  const hourly: HourlyStats = {
    hours: hourTotals.map((cards, hour) => ({ hour, cards })),
    busiestHour: totalCards > 0 ? hourTotals.indexOf(Math.max(...hourTotals)) : null,
    total: totalCards,
  };

  // ── Conteo de tarjetas ───────────────────────────────────────────────────────
  // Estado actual de la biblioteca: no se filtra por periodo. "Nunca estudiada" mira
  // todo el historial del ámbito, porque una carta estudiada hace un año no es nueva.
  const everStudied = new Set(scopedEvents.map((event) => event.cardId));
  const studiedOnce = scopedCards.filter((card) => everStudied.has(card.id)).length;
  const todayCardIds = new Set(todayEvents.map((event) => event.cardId));
  const counts: CardCountStats = {
    total: scopedCards.length,
    neverStudied: scopedCards.length - studiedOnce,
    studiedAtLeastOnce: studiedOnce,
    studiedToday: scopedCards.filter((card) => todayCardIds.has(card.id)).length,
    // El reparto por estado del scheduler describe la biblioteca de hoy, igual que el resto
    // de este bloque: no depende del periodo.
    scheduler: buildSchedulerCounts(scopedCards),
  };

  // ── Tarjetas añadidas ────────────────────────────────────────────────────────
  // La serie es histórica: cuenta altas reales, incluidas las de cartas ya borradas.
  // El baseline es estado actual: las cartas que hoy existen y nunca tuvieron alta
  // registrada porque son anteriores al tracking. No se les fabrica una fecha.
  const addedCardIds = new Set(scopedAdditions.map((added) => added.cardId));
  const added: AddedStats = {
    series: densify(addedByDay, days),
    totalInPeriod: rangedAdditions.length,
    baseline: scopedCards.filter((card) => !addedCardIds.has(card.id)).length,
    trackedSince: history.trackedSince,
  };

  // ── Origen ───────────────────────────────────────────────────────────────────
  const originOf = new Map(scopedAdditions.map((entry) => [entry.cardId, entry.origin]));
  const originCounts = new Map<OriginKey, number>();
  for (const card of scopedCards) {
    const key: OriginKey = originOf.get(card.id) ?? 'desconocido';
    originCounts.set(key, (originCounts.get(key) ?? 0) + 1);
  }
  const originTotal = scopedCards.length;
  const unknown = originCounts.get('desconocido') ?? 0;
  const origin: OriginStats = {
    slices: [...cardOrigins, 'desconocido' as const].map((key) => {
      const cards = originCounts.get(key) ?? 0;
      return { origin: key, cards, percent: round1(ratio(cards * 100, originTotal)) ?? 0 };
    }),
    total: originTotal,
    known: originTotal - unknown,
    unknown,
  };

  // ── Comparación de mazos ─────────────────────────────────────────────────────
  let deckComparison: DeckComparisonRow[] | null = null;
  if (scope.kind === 'all') {
    const byDeck = new Map<string, { studied: number; activeMs: number; sessions: number }>();
    const bucket = (deckId: string) => {
      let entry = byDeck.get(deckId);
      if (!entry) {
        entry = { studied: 0, activeMs: 0, sessions: 0 };
        byDeck.set(deckId, entry);
      }
      return entry;
    };
    for (const event of rangedEvents) {
      const entry = bucket(event.deckId);
      entry.studied += 1;
      entry.activeMs += event.activeMs;
    }
    for (const session of rangedSessions) {
      bucket(session.deckId).sessions += 1;
    }

    deckComparison = [...byDeck.entries()]
      .map(([deckId, entry]) => {
        const { name, deleted } = resolveDeckName(deckId, library, history.deckSnapshots);
        return {
          deckId,
          name,
          deleted,
          studied: entry.studied,
          activeMs: entry.activeMs,
          sessions: entry.sessions,
          secondsPerCard: round1(ratio(entry.activeMs / 1000, entry.studied)),
        };
      })
      // Mayor actividad primero; a igualdad, por identificador, para que el orden sea
      // estable y el mismo informe produzca siempre el mismo PDF.
      .sort((a, b) => b.studied - a.studied || a.deckId.localeCompare(b.deckId));
  }

  // ── Repetición espaciada ─────────────────────────────────────────────────────
  // Answer Buttons y True Retention describen actividad, así que se filtran igual que el
  // resto de secciones. Las de inventario miran la biblioteca de hoy. Future Due usa el
  // periodo como horizonte hacia delante. Está todo explicado en fsrs.ts.
  const allScopedReviews = scopedReviews(history.reviews, scope);
  const periodReviews = rangedReviews(allScopedReviews, range);

  const answerButtons = buildAnswerButtons(
    periodReviews,
    countUnratedEvents(rangedEvents, periodReviews),
    history.ratedSince,
  );
  const trueRetention = buildTrueRetention(allScopedReviews, today, history.ratedSince);
  const futureDue = buildFutureDue(scopedCards, now, today, range.days);
  const reviewIntervals = buildReviewIntervals(scopedCards);
  const stability = buildStabilityStats(scopedCards);
  const difficulty = buildDifficultyStats(scopedCards);
  const retrievability = buildRetrievabilityStats(scopedCards, scheduler, now);

  const scopeResolved =
    scope.kind === 'all'
      ? { name: 'Todos los mazos', deleted: false }
      : resolveDeckName(scope.deckId, library, history.deckSnapshots);

  return {
    scope,
    scopeLabel: scopeResolved.name,
    scopeDeleted: scope.kind === 'deck' && scopeResolved.deleted,
    period,
    periodLabel: periodLabels[period],
    range,
    today,
    trackedSince: history.trackedSince,
    empty: totalCards === 0 && rangedSessions.length === 0,
    todayStats,
    activity,
    calendar,
    time,
    speed,
    streak,
    hourly,
    counts,
    added,
    origin,
    deckComparison,
    ratedSince: history.ratedSince,
    answerButtons,
    trueRetention,
    futureDue,
    reviewIntervals,
    stability,
    difficulty,
    retrievability,
    deferred: [...deferredMetrics],
  };
}
