import type { BarChartPoint } from '../../components/stats';
import type { Deck } from '../../types/domain';

import type { StatsReport } from './engine';
import {
  formatAverage,
  formatDayLong,
  formatDayShort,
  formatDuration,
  formatHour,
  formatInstantLong,
  formatNumber,
  formatPercent,
  formatSeconds,
  originLabels,
  UNKNOWN,
} from './format';
import { periodShortLabels } from './time';
import { statsPeriods, type StatsPeriod, type StatsScope } from './types';

/**
 * Adaptación del informe a lo que pinta la pantalla.
 *
 * La pantalla no agrega nada: el motor produce los números y esto los convierte en textos
 * y en puntos de gráfica (docs/ARCHITECTURE.md, regla 1). Ponerlo aquí y no dentro del
 * componente permite además comprobar en un test unitario que una barra anuncia el valor
 * correcto, sin montar la interfaz.
 */

export type ScopeOption = { value: string; label: string };

export const ALL_DECKS = 'todos';

/** Opciones del selector de ámbito: primero "Todos los mazos", luego los mazos por nombre. */
export function scopeOptions(decks: readonly Deck[]): ScopeOption[] {
  return [
    { value: ALL_DECKS, label: 'Todos los mazos' },
    ...[...decks]
      .sort((a, b) => a.name.localeCompare(b.name, 'es'))
      .map((deck) => ({ value: deck.id, label: deck.name })),
  ];
}

export function scopeFromValue(value: string): StatsScope {
  return value === ALL_DECKS ? { kind: 'all' } : { kind: 'deck', deckId: value };
}

export const periodOptions: readonly { value: StatsPeriod; label: string }[] = statsPeriods.map(
  (period) => ({ value: period, label: periodShortLabels[period] }),
);

function plural(count: number, singular: string, many: string): string {
  return count === 1 ? `1 ${singular}` : `${formatNumber(count)} ${many}`;
}

/** Cifras de "Hoy". `decksStudied` solo aparece cuando el ámbito es global. */
export function todayMetrics(report: StatsReport) {
  const { todayStats } = report;
  const metrics = [
    { label: 'Tarjetas estudiadas', value: formatNumber(todayStats.studied) },
    {
      label: 'Tarjetas únicas',
      value: formatNumber(todayStats.unique),
      hint: 'Sin contar los repasos repetidos',
    },
    { label: 'Tiempo de estudio', value: formatDuration(todayStats.activeMs) },
    {
      label: 'Segundos por tarjeta',
      value: formatSeconds(todayStats.secondsPerCard),
      hint: todayStats.studied === 0 ? 'Todavía sin tarjetas hoy' : undefined,
    },
    { label: 'Sesiones', value: formatNumber(todayStats.sessions) },
  ];

  if (todayStats.decksStudied !== null) {
    metrics.push({ label: 'Mazos estudiados', value: formatNumber(todayStats.decksStudied) });
  }
  return metrics;
}

export function activityMetrics(report: StatsReport) {
  const { activity } = report;
  return [
    { label: 'Total', value: formatNumber(activity.total) },
    {
      label: 'Días estudiados',
      value: `${formatNumber(activity.daysStudied)} de ${formatNumber(activity.daysInPeriod)}`,
    },
    {
      label: 'Promedio del periodo',
      value: `${formatAverage(activity.averageOverPeriod)} / día`,
    },
    {
      label: 'Promedio en días activos',
      value: `${formatAverage(activity.averageForDaysStudied)} / día`,
      hint: activity.daysStudied === 0 ? 'Sin días con actividad' : undefined,
    },
  ];
}

export function timeMetrics(report: StatsReport) {
  const { time } = report;
  return [
    { label: 'Tiempo total', value: formatDuration(time.totalMs) },
    { label: 'Por día activo', value: formatDuration(time.averagePerActiveDayMs) },
    {
      label: 'Sesión promedio',
      value: formatDuration(time.averageSessionMs),
      hint: 'Solo sesiones terminadas',
    },
    { label: 'Sesión más larga', value: formatDuration(time.longestSessionMs) },
    { label: 'Sesiones', value: formatNumber(time.sessions) },
  ];
}

export function speedMetrics(report: StatsReport) {
  const { speed } = report;
  return [
    {
      label: 'Promedio por tarjeta',
      value: formatSeconds(speed.averageSeconds),
      hint: speed.averageSeconds === null ? 'Sin tarjetas completadas' : undefined,
    },
    { label: 'Día más rápido', value: formatSeconds(speed.fastestDaySeconds) },
    { label: 'Día más lento', value: formatSeconds(speed.slowestDaySeconds) },
  ];
}

export function streakMetrics(report: StatsReport) {
  const { streak } = report;
  return [
    { label: 'Racha actual', value: plural(streak.current, 'día', 'días') },
    { label: 'Mejor racha', value: plural(streak.best, 'día', 'días') },
    { label: 'Días estudiados', value: plural(streak.daysStudied, 'día', 'días') },
  ];
}

export function countMetrics(report: StatsReport) {
  const { counts } = report;
  return [
    { label: 'Total de tarjetas', value: formatNumber(counts.total) },
    { label: 'Nunca estudiadas', value: formatNumber(counts.neverStudied) },
    { label: 'Estudiadas alguna vez', value: formatNumber(counts.studiedAtLeastOnce) },
    { label: 'Estudiadas hoy', value: formatNumber(counts.studiedToday) },
  ];
}

export function addedMetrics(report: StatsReport) {
  const { added } = report;
  return [
    { label: 'Añadidas en el periodo', value: formatNumber(added.totalInPeriod) },
    {
      label: 'Anteriores al tracking',
      value: formatNumber(added.baseline),
      hint: 'Sin fecha de alta registrada',
    },
  ];
}

export function hourlyMetrics(report: StatsReport) {
  const { hourly } = report;
  return [
    {
      label: 'Hora más activa',
      value: hourly.busiestHour === null ? UNKNOWN : `${formatHour(hourly.busiestHour)}:00`,
    },
    { label: 'Tarjetas en el periodo', value: formatNumber(hourly.total) },
  ];
}

/** Barras de tarjetas por día. Cada una anuncia su fecha larga y su recuento. */
export function activityBars(report: StatsReport): BarChartPoint[] {
  return report.activity.series.map((point) => ({
    key: point.day,
    label: formatDayShort(point.day),
    value: point.value,
    accessibilityLabel: `${formatDayLong(point.day)}: ${plural(point.value, 'tarjeta', 'tarjetas')}.`,
  }));
}

/** Barras de tiempo por día, en minutos: en horas todo quedaría por debajo de 1. */
export function timeBars(report: StatsReport): BarChartPoint[] {
  return report.time.series.map((point) => ({
    key: point.day,
    label: formatDayShort(point.day),
    value: point.value / 60000,
    accessibilityLabel: `${formatDayLong(point.day)}: ${formatDuration(point.value)}.`,
  }));
}

export function speedBars(report: StatsReport): BarChartPoint[] {
  return report.speed.series.map((point) => ({
    key: point.day,
    label: formatDayShort(point.day),
    value: point.value,
    accessibilityLabel: `${formatDayLong(point.day)}: ${formatSeconds(point.value)} por tarjeta.`,
  }));
}

export function addedBars(report: StatsReport): BarChartPoint[] {
  return report.added.series.map((point) => ({
    key: point.day,
    label: formatDayShort(point.day),
    value: point.value,
    accessibilityLabel: `${formatDayLong(point.day)}: ${plural(point.value, 'tarjeta añadida', 'tarjetas añadidas')}.`,
  }));
}

export function hourlyBars(report: StatsReport): BarChartPoint[] {
  return report.hourly.hours.map((hour) => ({
    key: String(hour.hour),
    label: formatHour(hour.hour),
    value: hour.cards,
    accessibilityLabel: `A las ${formatHour(hour.hour)}:00, ${plural(hour.cards, 'tarjeta', 'tarjetas')}.`,
  }));
}

export const deckComparisonColumns = [
  { key: 'mazo', header: 'Mazo', flex: 3 },
  { key: 'estudiadas', header: 'Estudiadas', align: 'right' as const, flex: 2 },
  { key: 'tiempo', header: 'Tiempo', align: 'right' as const, flex: 2 },
  { key: 'sesiones', header: 'Sesiones', align: 'right' as const, flex: 2 },
  { key: 'promedio', header: 's/tarjeta', align: 'right' as const, flex: 2 },
];

export function deckComparisonRows(report: StatsReport) {
  return (report.deckComparison ?? []).map((row) => {
    // Un mazo eliminado se nombra, pero se dice que está eliminado: nunca debe parecer que
    // sigue en la biblioteca (docs/PRODUCT.md, 2026-08-23).
    const name = row.deleted ? `${row.name} (eliminado)` : row.name;
    return {
      key: row.deckId,
      muted: row.deleted,
      cells: [
        name,
        formatNumber(row.studied),
        formatDuration(row.activeMs),
        formatNumber(row.sessions),
        formatSeconds(row.secondsPerCard),
      ],
      accessibilityLabel:
        `${name}: ${plural(row.studied, 'tarjeta estudiada', 'tarjetas estudiadas')}, ` +
        `${formatDuration(row.activeMs)}, ${plural(row.sessions, 'sesión', 'sesiones')}, ` +
        `${formatSeconds(row.secondsPerCard)} por tarjeta.`,
    };
  });
}

export const originColumns = [
  { key: 'origen', header: 'Origen', flex: 3 },
  { key: 'tarjetas', header: 'Tarjetas', align: 'right' as const, flex: 1 },
  { key: 'porcentaje', header: 'Porcentaje', align: 'right' as const, flex: 1 },
];

export function originRows(report: StatsReport) {
  return report.origin.slices.map((slice) => {
    const label = originLabels[slice.origin];
    return {
      key: slice.origin,
      cells: [label, formatNumber(slice.cards), formatPercent(slice.percent)],
      accessibilityLabel: `${label}: ${plural(slice.cards, 'tarjeta', 'tarjetas')}, ${formatPercent(slice.percent)}.`,
    };
  });
}

export const deferredColumns = [
  { key: 'metrica', header: 'Métrica de Anki', flex: 2 },
  { key: 'motivo', header: 'Por qué no se muestra', flex: 5 },
];

export function deferredRows(report: StatsReport) {
  return report.deferred.map((metric) => ({
    key: metric.anki,
    cells: [metric.anki, metric.reason],
    accessibilityLabel: `${metric.anki}: ${metric.reason}`,
  }));
}

/** Frase que sitúa el informe: desde cuándo hay historial fiable. */
export function trackingNotice(report: StatsReport): string {
  if (report.trackedSince === null) {
    return 'Todavía no hay historial de estudio registrado en este dispositivo.';
  }
  return `Historial de estudio registrado desde ${formatInstantLong(report.trackedSince)}. Lo anterior a esa fecha no se registró y no se ha reconstruido.`;
}
