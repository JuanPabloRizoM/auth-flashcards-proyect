import { chart, colors } from '../../../theme';
import { formatIntervalDays } from '../../scheduler/format';
import { reviewRatingLabels, reviewRatings } from '../../scheduler/types';
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
} from '../format';
import { weekdayOfDay } from '../time';
import type { DayPoint, StatsReport } from '../engine';
import type { DistributionStats } from '../fsrs';

import {
  A4,
  createPdfDocument,
  hexColor,
  truncateText,
  type PdfColor,
  type PdfDocument,
  type PdfPage,
} from './writer';

/**
 * Construcción del reporte PDF a partir de un informe del motor.
 *
 * Recibe un `StatsReport` ya calculado; no vuelve a agregar nada. Es lo que garantiza que
 * para el mismo ámbito y periodo el PDF y el dashboard digan exactamente lo mismo: hay una
 * sola implementación de las fórmulas, y está en `engine.ts`.
 *
 * La paleta sale del theme de la aplicación (docs/DESIGN.md): azul tinta, verde académico,
 * crema y carbón. Ni neón ni brillos, aquí tampoco.
 */

const MARGIN = 48;
const CONTENT_WIDTH = A4.width - MARGIN * 2;
const BOTTOM = A4.height - MARGIN;

const ink = {
  text: hexColor(colors.text),
  muted: hexColor(colors.textMuted),
  primary: hexColor(colors.primary),
  primarySurface: hexColor(colors.primarySurface),
  success: hexColor(colors.success),
  border: hexColor(colors.border),
  surfaceMuted: hexColor(colors.surfaceMuted),
  background: hexColor(colors.background),
};

const APP_NAME = 'Flashcards';

export type ReportOptions = {
  /** Instante de generación. Se inyecta para que los tests afirmen sobre una fecha fija. */
  generatedAt: number;
};

/**
 * Cursor de maquetación.
 *
 * Lleva la cuenta de cuánto queda de página y abre una nueva cuando la siguiente sección
 * no cabe. Es lo que hace que el reporte sea multipágina de verdad y no una tira infinita.
 */
type Flow = {
  page: PdfPage;
  y: number;
};

function createFlow(document: PdfDocument): Flow {
  return { page: document.addPage(), y: MARGIN };
}

function newPage(document: PdfDocument, flow: Flow): void {
  flow.page = document.addPage();
  flow.y = MARGIN;
}

/** Abre página nueva si lo que viene no cabe entero. Nunca parte una gráfica en dos. */
function ensure(document: PdfDocument, flow: Flow, height: number): void {
  if (flow.y + height > BOTTOM) newPage(document, flow);
}

function sectionTitle(flow: Flow, title: string, description?: string): void {
  flow.page.text(MARGIN, flow.y + 12, title, { size: 14, font: 'bold', color: ink.text });
  flow.y += 18;
  if (description) {
    flow.page.text(MARGIN, flow.y + 9, description, { size: 9, color: ink.muted });
    flow.y += 13;
  }
  flow.page.line(MARGIN, flow.y, MARGIN + CONTENT_WIDTH, flow.y, ink.border);
  flow.y += 14;
}

/**
 * Rejilla de cifras: etiqueta arriba, valor grande debajo.
 *
 * Cada casilla se recorta al ancho útil de su columna. Sin eso, una etiqueta algo más larga
 * que la columna se metería en la siguiente sin dar ningún aviso, y el PDF saldría
 * técnicamente válido pero visualmente roto.
 */
const GRID_GUTTER = 10;

function metricGrid(
  flow: Flow,
  entries: readonly { label: string; value: string }[],
  columns = 3,
): void {
  const columnWidth = CONTENT_WIDTH / columns;
  const usableWidth = columnWidth - GRID_GUTTER;
  const rows = Math.ceil(entries.length / columns);

  entries.forEach((entry, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = MARGIN + column * columnWidth;
    const y = flow.y + row * 34;
    flow.page.text(x, y + 9, truncateText(entry.label.toUpperCase(), 7, usableWidth), {
      size: 7,
      color: ink.muted,
    });
    flow.page.text(x, y + 24, truncateText(entry.value, 13, usableWidth), {
      size: 13,
      font: 'bold',
      color: ink.text,
    });
  });

  flow.y += rows * 34 + 6;
}

function emptyNote(flow: Flow, message: string): void {
  flow.page.rect(MARGIN, flow.y, CONTENT_WIDTH, 30, ink.surfaceMuted);
  flow.page.text(MARGIN + 10, flow.y + 19, message, { size: 9, color: ink.muted });
  flow.y += 38;
}

type BarChartOptions = {
  points: readonly { label: string; value: number }[];
  height?: number;
  /** Cómo se lee el valor del pico. El eje solo rotula el máximo, para no saturar. */
  formatValue: (value: number) => string;
  color?: PdfColor;
  /** Cuántas etiquetas del eje horizontal, como mucho. */
  maxLabels?: number;
  emptyMessage: string;
};

/**
 * Gráfica de barras.
 *
 * Las barras se reparten el ancho disponible, así que una serie de 365 días y otra de 30
 * ocupan lo mismo y se leen igual. El eje horizontal rotula solo unas pocas fechas: con
 * una por barra el texto se solaparía y dejaría de informar.
 */
function barChart(document: PdfDocument, flow: Flow, options: BarChartOptions): void {
  const height = options.height ?? 110;
  const total = options.points.reduce((sum, point) => sum + point.value, 0);

  if (options.points.length === 0 || total <= 0) {
    emptyNote(flow, options.emptyMessage);
    return;
  }

  ensure(document, flow, height + 30);

  const max = options.points.reduce((peak, point) => Math.max(peak, point.value), 0);
  const chartTop = flow.y;
  const chartBottom = chartTop + height;
  const fill = options.color ?? ink.primary;

  // Eje y su etiqueta de máximo: sin una referencia numérica, la altura de una barra no
  // dice nada.
  flow.page.line(MARGIN, chartBottom, MARGIN + CONTENT_WIDTH, chartBottom, ink.border);
  flow.page.text(MARGIN + CONTENT_WIDTH, chartTop + 8, options.formatValue(max), {
    size: 8,
    color: ink.muted,
    align: 'right',
  });

  const slot = CONTENT_WIDTH / options.points.length;
  const barWidth = Math.max(0.8, Math.min(slot * 0.72, 26));

  options.points.forEach((point, index) => {
    if (point.value <= 0) return;
    const barHeight = Math.max(1, (point.value / max) * (height - 12));
    const x = MARGIN + index * slot + (slot - barWidth) / 2;
    flow.page.rect(x, chartBottom - barHeight, barWidth, barHeight, fill);
  });

  // Etiquetas del eje horizontal, repartidas.
  const maxLabels = options.maxLabels ?? 8;
  const step = Math.max(1, Math.ceil(options.points.length / maxLabels));
  options.points.forEach((point, index) => {
    if (index % step !== 0) return;
    const x = MARGIN + index * slot + slot / 2;
    flow.page.text(x, chartBottom + 11, point.label, {
      size: 6.5,
      color: ink.muted,
      align: 'center',
    });
  });

  flow.y = chartBottom + 22;
}

/**
 * Calendario de actividad.
 *
 * Una columna por semana y una fila por día de la semana, como el mapa de calor de Anki.
 * La intensidad va del crema al azul tinta en cinco pasos; el detalle numérico de cada día
 * vive en la gráfica de actividad, no en el color, para que el color no sea el único
 * portador de la información.
 */
function calendarChart(document: PdfDocument, flow: Flow, report: StatsReport): void {
  const days = report.calendar.days;
  if (days.length === 0 || report.calendar.maxCards === 0) {
    emptyNote(flow, 'Sin actividad registrada en este periodo.');
    return;
  }

  const cell = 7;
  const gap = 2;
  const weeks = Math.ceil((days.length + weekdayOfDay(days[0]!.day)) / 7);
  const gridHeight = 7 * (cell + gap);

  ensure(document, flow, gridHeight + 34);

  const top = flow.y;
  const available = CONTENT_WIDTH - 18;
  // Si el periodo es muy largo, las columnas se estrechan antes que salirse de la página.
  const columnWidth = Math.min(cell + gap, available / Math.max(1, weeks));

  // La escala sale del theme, igual que la del calendario de la pantalla. Copiarla aquí
  // habría creado una segunda fuente de verdad: cambiarla en un sitio dejaría los dos
  // calendarios de distinto color sin que nada avisara (docs/DESIGN.md).
  const levels: PdfColor[] = chart.calendarScale.map(hexColor);

  const weekdayLabels = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
  weekdayLabels.forEach((label, index) => {
    flow.page.text(MARGIN, top + index * (cell + gap) + cell, label, {
      size: 5.5,
      color: ink.muted,
    });
  });

  const offset = weekdayOfDay(days[0]!.day);
  days.forEach((day, index) => {
    const position = index + offset;
    const week = Math.floor(position / 7);
    const weekday = position % 7;
    const x = MARGIN + 14 + week * columnWidth;
    const y = top + weekday * (cell + gap);
    flow.page.rect(x, y, Math.min(cell, columnWidth - gap), cell, levels[day.level] ?? levels[0]!);
  });

  flow.y = top + gridHeight + 6;

  // Leyenda con los extremos escritos: la escala de color se explica en palabras.
  flow.page.text(MARGIN + 14, flow.y + 8, `Sin actividad`, { size: 6.5, color: ink.muted });
  levels.forEach((level, index) => {
    flow.page.rect(MARGIN + 78 + index * 10, flow.y + 2, 7, 7, level);
  });
  flow.page.text(
    MARGIN + 78 + levels.length * 10 + 4,
    flow.y + 8,
    `Máximo: ${formatNumber(report.calendar.maxCards)} tarjetas en un día`,
    { size: 6.5, color: ink.muted },
  );
  flow.y += 22;
}

type TableColumn = { header: string; width: number; align?: 'left' | 'right' };

function table(
  document: PdfDocument,
  flow: Flow,
  columns: readonly TableColumn[],
  rows: readonly (readonly string[])[],
): void {
  const rowHeight = 16;
  ensure(document, flow, rowHeight * Math.min(rows.length + 1, 6));

  const drawHeader = () => {
    let x = MARGIN;
    for (const column of columns) {
      flow.page.text(column.align === 'right' ? x + column.width : x, flow.y + 10, column.header, {
        size: 8,
        font: 'bold',
        color: ink.muted,
        align: column.align === 'right' ? 'right' : 'left',
      });
      x += column.width;
    }
    flow.y += rowHeight;
    flow.page.line(MARGIN, flow.y - 4, MARGIN + CONTENT_WIDTH, flow.y - 4, ink.border);
  };

  drawHeader();

  for (const row of rows) {
    if (flow.y + rowHeight > BOTTOM) {
      newPage(document, flow);
      drawHeader();
    }
    let x = MARGIN;
    row.forEach((cell, index) => {
      const column = columns[index];
      if (!column) return;
      const text = truncateText(cell, 9, column.width - 6);
      flow.page.text(column.align === 'right' ? x + column.width : x, flow.y + 10, text, {
        size: 9,
        color: ink.text,
        align: column.align === 'right' ? 'right' : 'left',
      });
      x += column.width;
    });
    flow.y += rowHeight;
  }

  flow.y += 8;
}

/**
 * Cómo se anuncia el horizonte de Future Due.
 *
 * El selector de periodo se reutiliza como horizonte, pero sus etiquetas miran hacia atrás
 * ("último mes"). Aquí se mira hacia delante, así que se dice en esos términos.
 */
function futureDueHorizonLabel(report: StatsReport): string {
  const dias = report.futureDue.horizonDays;
  if (dias === null) return 'Repasos programados hacia delante, sin límite de horizonte.';
  return `Repasos programados para los próximos ${formatNumber(dias)} días.`;
}

/** Por qué una sección de calificación está vacía. Nunca se sustituye por ceros. */
function ratingNote(report: StatsReport): string {
  if (report.ratedSince === null) {
    return 'Todavía no se ha calificado ninguna tarjeta en este dispositivo. Esta sección aparecerá en cuanto se estudie con Otra vez, Difícil, Bien o Fácil.';
  }
  return `Sin calificaciones en este ámbito y periodo. Hay datos de calificación desde ${formatInstantLong(report.ratedSince)}; la actividad anterior se registró sin calificación y no se cuenta aquí.`;
}

type DistributionOptions = {
  emptyMessage: string;
  unit: string;
  /** Cómo se lee la mediana y la media de esta magnitud. */
  format: (value: number | null) => string;
  sampleLabel: string;
  color?: PdfColor;
  maxLabels?: number;
  /**
   * Cuarta cifra de la rejilla.
   *
   * Por defecto el máximo, que es lo interesante en un intervalo o en una estabilidad. En la
   * probabilidad de recuerdo interesa el mínimo —la tarjeta que peor se recuerda—, y es lo
   * que muestra el panel: el PDF tiene que decir lo mismo.
   */
  extreme?: 'max' | 'min';
};

/**
 * Una distribución con su gráfica y sus tres cifras.
 *
 * Las cuatro secciones del scheduler que son distribuciones —intervalos, estabilidad,
 * dificultad y probabilidad de recuerdo— se dibujan igual. Repetir el bloque cuatro veces
 * habría multiplicado por cuatro el sitio donde equivocarse.
 */
function distributionSection(
  document: PdfDocument,
  flow: Flow,
  distribution: DistributionStats,
  options: DistributionOptions,
): void {
  if (distribution.samples === 0) {
    emptyNote(flow, options.emptyMessage);
    return;
  }
  barChart(document, flow, {
    points: distribution.buckets.map((bucket) => ({
      label: bucket.label,
      value: bucket.count,
    })),
    formatValue: (value) => `${formatNumber(value)} ${options.unit}`,
    color: options.color,
    maxLabels: options.maxLabels ?? 11,
    emptyMessage: options.emptyMessage,
  });
  metricGrid(
    flow,
    [
      { label: options.sampleLabel, value: formatNumber(distribution.samples) },
      { label: 'Mediana', value: options.format(distribution.median) },
      { label: 'Media', value: options.format(distribution.average) },
      options.extreme === 'min'
        ? { label: 'Mínima', value: options.format(distribution.min) }
        : { label: 'Máximo', value: options.format(distribution.max) },
    ],
    4,
  );
}

function pointsFrom(series: readonly DayPoint[], transform: (value: number) => number = (v) => v) {
  return series.map((point) => ({ label: formatDayShort(point.day), value: transform(point.value) }));
}

/**
 * Construye el reporte completo.
 *
 * El orden sigue el del PDF de Anki en lo que tiene sentido conservar (resumen, actividad,
 * calendario, conteo, añadidas, distribución horaria) y se salta lo que aquí no puede
 * calcularse todavía, que se declara al final en vez de dibujarse a cero.
 */
export function buildStatsPdf(report: StatsReport, options: ReportOptions): Uint8Array {
  const document = createPdfDocument({
    title: `Reporte de estudio — ${report.scopeLabel} — ${report.periodLabel}`,
  });
  const flow = createFlow(document);

  // ── Portada ────────────────────────────────────────────────────────────────
  flow.page.rect(0, 0, A4.width, 96, ink.primarySurface);
  flow.page.text(MARGIN, 40, APP_NAME, { size: 11, font: 'bold', color: ink.primary });
  flow.page.text(MARGIN, 70, 'Reporte de estudio', { size: 24, font: 'bold', color: ink.text });
  flow.y = 120;

  const scopeLine = report.scopeDeleted
    ? `${report.scopeLabel} (mazo eliminado)`
    : report.scopeLabel;

  metricGrid(
    flow,
    [
      { label: 'Mazo', value: scopeLine },
      { label: 'Periodo', value: report.periodLabel },
      { label: 'Generado', value: formatInstantLong(options.generatedAt) },
    ],
    3,
  );

  flow.page.text(
    MARGIN,
    flow.y + 10,
    report.trackedSince === null
      ? 'Historial de estudio todavía no registrado en este dispositivo.'
      : `Historial de estudio registrado desde ${formatInstantLong(report.trackedSince)}.`,
    { size: 9, color: ink.muted },
  );
  flow.y += 18;
  flow.page.text(
    MARGIN,
    flow.y + 10,
    'Las estadísticas anteriores a esa fecha no existen y no se han reconstruido.',
    { size: 9, color: ink.muted },
  );
  flow.y += 30;

  // ── Resumen ────────────────────────────────────────────────────────────────
  sectionTitle(flow, 'Resumen', `Actividad del ámbito y periodo seleccionados.`);
  metricGrid(
    flow,
    [
      { label: 'Tarjetas estudiadas', value: formatNumber(report.activity.total) },
      { label: 'Tarjetas únicas', value: formatNumber(report.activity.uniqueCards) },
      { label: 'Tiempo de estudio', value: formatDuration(report.time.totalMs) },
      { label: 'Sesiones', value: formatNumber(report.time.sessions) },
      { label: 'Días activos', value: formatNumber(report.activity.daysStudied) },
      { label: 'Racha actual', value: `${formatNumber(report.streak.current)} días` },
      { label: 'Mejor racha', value: `${formatNumber(report.streak.best)} días` },
      { label: 'Promedio por tarjeta', value: formatSeconds(report.speed.averageSeconds) },
      { label: 'Promedio por día activo', value: formatAverage(report.activity.averageForDaysStudied) },
    ],
    3,
  );

  if (report.empty) {
    emptyNote(
      flow,
      'No hay actividad de estudio registrada en este ámbito y periodo. Las cifras de arriba lo reflejan y no se han estimado.',
    );
  }

  // ── Actividad ──────────────────────────────────────────────────────────────
  ensure(document, flow, 190);
  sectionTitle(flow, 'Tarjetas estudiadas por día', 'Cuántas tarjetas se completaron cada día.');
  barChart(document, flow, {
    points: pointsFrom(report.activity.series),
    formatValue: (value) => `${formatNumber(value)} tarjetas`,
    emptyMessage: 'Sin tarjetas estudiadas en este periodo.',
  });
  metricGrid(
    flow,
    [
      { label: 'Total', value: formatNumber(report.activity.total) },
      {
        label: 'Días estudiados',
        value: `${formatNumber(report.activity.daysStudied)} de ${formatNumber(report.activity.daysInPeriod)}`,
      },
      { label: 'Promedio sobre el periodo', value: formatAverage(report.activity.averageOverPeriod) },
      {
        label: 'Promedio en días estudiados',
        value: formatAverage(report.activity.averageForDaysStudied),
      },
    ],
    4,
  );

  // ── Calendario ─────────────────────────────────────────────────────────────
  ensure(document, flow, 150);
  sectionTitle(
    flow,
    'Calendario de actividad',
    `Del ${formatDayLong(report.calendar.fromDay)} al ${formatDayLong(report.calendar.toDay)}. La intensidad es el número de tarjetas estudiadas ese día.`,
  );
  calendarChart(document, flow, report);

  // ── Tiempo ─────────────────────────────────────────────────────────────────
  ensure(document, flow, 200);
  sectionTitle(flow, 'Tiempo de estudio', 'Minutos activos por día. El tiempo en segundo plano no cuenta.');
  barChart(document, flow, {
    points: pointsFrom(report.time.series, (value) => value / 60000),
    formatValue: (value) => `${formatAverage(value)} min`,
    color: ink.success,
    emptyMessage: 'Sin tiempo de estudio registrado en este periodo.',
  });
  metricGrid(
    flow,
    [
      { label: 'Total', value: formatDuration(report.time.totalMs) },
      { label: 'Por día activo', value: formatDuration(report.time.averagePerActiveDayMs) },
      { label: 'Sesión promedio', value: formatDuration(report.time.averageSessionMs) },
      { label: 'Sesión más larga', value: formatDuration(report.time.longestSessionMs) },
    ],
    4,
  );

  // ── Velocidad ──────────────────────────────────────────────────────────────
  ensure(document, flow, 200);
  sectionTitle(flow, 'Velocidad', 'Segundos por tarjeta. Solo aparecen los días con actividad.');
  barChart(document, flow, {
    points: report.speed.series.map((point) => ({
      label: formatDayShort(point.day),
      value: point.value,
    })),
    formatValue: (value) => formatSeconds(value),
    color: ink.primary,
    emptyMessage: 'Sin datos de velocidad: no se ha completado ninguna tarjeta en este periodo.',
  });
  metricGrid(
    flow,
    [
      { label: 'Promedio', value: formatSeconds(report.speed.averageSeconds) },
      { label: 'Día más rápido', value: formatSeconds(report.speed.fastestDaySeconds) },
      { label: 'Día más lento', value: formatSeconds(report.speed.slowestDaySeconds) },
    ],
    3,
  );

  // ── Conteo de tarjetas ─────────────────────────────────────────────────────
  ensure(document, flow, 140);
  sectionTitle(
    flow,
    'Conteo de tarjetas',
    'Estado actual de la biblioteca en este ámbito. No depende del periodo.',
  );
  metricGrid(
    flow,
    [
      { label: 'Total', value: formatNumber(report.counts.total) },
      { label: 'Nunca estudiadas', value: formatNumber(report.counts.neverStudied) },
      { label: 'Estudiadas al menos una vez', value: formatNumber(report.counts.studiedAtLeastOnce) },
      { label: 'Estudiadas hoy', value: formatNumber(report.counts.studiedToday) },
    ],
    4,
  );

  // ── Añadidas ───────────────────────────────────────────────────────────────
  ensure(document, flow, 200);
  sectionTitle(
    flow,
    'Tarjetas añadidas',
    'Altas registradas desde que hay tracking. Las anteriores no tienen fecha y se cuentan aparte.',
  );
  barChart(document, flow, {
    points: pointsFrom(report.added.series),
    formatValue: (value) => `${formatNumber(value)} tarjetas`,
    color: ink.success,
    emptyMessage: 'Ninguna tarjeta añadida en este periodo.',
  });
  metricGrid(
    flow,
    [
      { label: 'Añadidas en el periodo', value: formatNumber(report.added.totalInPeriod) },
      { label: 'Anteriores al tracking', value: formatNumber(report.added.baseline) },
    ],
    2,
  );

  // ── Actividad por hora ─────────────────────────────────────────────────────
  ensure(document, flow, 200);
  sectionTitle(
    flow,
    'Actividad por hora',
    'Tarjetas completadas en cada hora local. El acierto por hora no se desglosa aquí: para eso están Calificaciones y Retención real.',
  );
  barChart(document, flow, {
    points: report.hourly.hours.map((hour) => ({
      label: formatHour(hour.hour),
      value: hour.cards,
    })),
    formatValue: (value) => `${formatNumber(value)} tarjetas`,
    maxLabels: 24,
    emptyMessage: 'Sin actividad por hora en este periodo.',
  });
  metricGrid(
    flow,
    [
      {
        label: 'Hora más activa',
        value: report.hourly.busiestHour === null ? UNKNOWN : `${formatHour(report.hourly.busiestHour)}:00`,
      },
      { label: 'Total', value: formatNumber(report.hourly.total) },
    ],
    2,
  );

  // ── Comparación de mazos ───────────────────────────────────────────────────
  // Solo en el reporte global. En el de un mazo no aparece, y por eso un PDF de un mazo
  // no puede contener el nombre ni las cifras de ningún otro.
  if (report.deckComparison !== null) {
    ensure(document, flow, 140);
    sectionTitle(flow, 'Comparación de mazos', 'Actividad de cada mazo en el periodo seleccionado.');
    if (report.deckComparison.length === 0) {
      emptyNote(flow, 'Ningún mazo registra actividad en este periodo.');
    } else {
      table(
        document,
        flow,
        [
          { header: 'Mazo', width: CONTENT_WIDTH - 300 },
          { header: 'Estudiadas', width: 80, align: 'right' },
          { header: 'Tiempo', width: 80, align: 'right' },
          { header: 'Sesiones', width: 60, align: 'right' },
          { header: 's/tarjeta', width: 80, align: 'right' },
        ],
        report.deckComparison.map((row) => [
          row.deleted ? `${row.name} (eliminado)` : row.name,
          formatNumber(row.studied),
          formatDuration(row.activeMs),
          formatNumber(row.sessions),
          formatSeconds(row.secondsPerCard),
        ]),
      );
    }
  }

  // ── Origen ─────────────────────────────────────────────────────────────────
  ensure(document, flow, 140);
  sectionTitle(
    flow,
    'Origen de las tarjetas',
    'De dónde salieron las tarjetas que existen hoy en este ámbito.',
  );
  if (report.origin.total === 0) {
    emptyNote(flow, 'No hay tarjetas en este ámbito.');
  } else {
    table(
      document,
      flow,
      [
        { header: 'Origen', width: CONTENT_WIDTH - 200 },
        { header: 'Tarjetas', width: 100, align: 'right' },
        { header: 'Porcentaje', width: 100, align: 'right' },
      ],
      report.origin.slices.map((slice) => [
        originLabels[slice.origin],
        formatNumber(slice.cards),
        formatPercent(slice.percent),
      ]),
    );
  }

  // ── Reparto por estado del scheduler ───────────────────────────────────────
  ensure(document, flow, 140);
  sectionTitle(
    flow,
    'Estado de las tarjetas',
    'Reparto por estado del scheduler. Young son las tarjetas de repaso con menos de 21 días de intervalo; Mature, las de 21 o más.',
  );
  metricGrid(
    flow,
    [
      { label: 'Nuevas', value: formatNumber(report.counts.scheduler.nuevas) },
      { label: 'Aprendiendo', value: formatNumber(report.counts.scheduler.aprendiendo) },
      { label: 'Reaprendiendo', value: formatNumber(report.counts.scheduler.reaprendiendo) },
      { label: 'Young', value: formatNumber(report.counts.scheduler.young) },
      { label: 'Mature', value: formatNumber(report.counts.scheduler.mature) },
    ],
    5,
  );

  // ── Próximos repasos ───────────────────────────────────────────────────────
  ensure(document, flow, 200);
  sectionTitle(
    flow,
    'Próximos repasos',
    `${futureDueHorizonLabel(report)} Las tarjetas nuevas no aparecen porque todavía no tienen fecha.`,
  );
  barChart(document, flow, {
    points: report.futureDue.buckets.map((bucket) => ({
      label: bucket.offset === 0 ? 'Hoy' : formatDayShort(bucket.day),
      value: bucket.reviews,
    })),
    formatValue: (value) => `${formatNumber(value)} repasos`,
    emptyMessage: 'No hay ningún repaso programado en este horizonte.',
  });
  metricGrid(
    flow,
    [
      { label: 'Programadas', value: formatNumber(report.futureDue.total) },
      { label: 'Vencidas ahora', value: formatNumber(report.futureDue.backlog) },
      { label: 'Días con repasos', value: formatNumber(report.futureDue.daysWithReviews) },
      { label: 'Media por día', value: formatAverage(report.futureDue.averagePerDay) },
    ],
    4,
  );

  // ── Calificaciones ─────────────────────────────────────────────────────────
  ensure(document, flow, 200);
  sectionTitle(
    flow,
    'Calificaciones',
    'Cuántas veces se usó cada botón en el periodo. La actividad anterior a la calificación se cuenta aparte.',
  );
  if (report.answerButtons.total === 0) {
    // Ni una gráfica de ceros ni una sección omitida en silencio: se dice por qué está vacía.
    emptyNote(flow, ratingNote(report));
  } else {
    barChart(document, flow, {
      points: reviewRatings.map((rating) => ({
        label: reviewRatingLabels[rating],
        value: report.answerButtons.slices.find((slice) => slice.rating === rating)?.reviews ?? 0,
      })),
      formatValue: (value) => `${formatNumber(value)} respuestas`,
      maxLabels: 4,
      emptyMessage: 'Sin calificaciones en este periodo.',
    });
    metricGrid(
      flow,
      [
        ...reviewRatings.map((rating) => ({
          label: reviewRatingLabels[rating],
          value: formatNumber(
            report.answerButtons.slices.find((slice) => slice.rating === rating)?.reviews ?? 0,
          ),
        })),
        { label: 'Sin calificar', value: formatNumber(report.answerButtons.unrated) },
      ],
      5,
    );
  }

  // ── Retención real ─────────────────────────────────────────────────────────
  ensure(document, flow, 180);
  sectionTitle(
    flow,
    'Retención real',
    'Porcentaje de repasos acertados. Otra vez es fallo; Difícil, Bien y Fácil son aciertos. Se cuenta el primer repaso de cada tarjeta en cada día.',
  );
  if (report.trueRetention.rows.every((row) => row.total.total === 0)) {
    emptyNote(flow, ratingNote(report));
  } else {
    table(
      document,
      flow,
      [
        { header: 'Periodo', width: CONTENT_WIDTH - 320 },
        { header: 'Young', width: 80, align: 'right' },
        { header: 'Mature', width: 80, align: 'right' },
        { header: 'Total', width: 80, align: 'right' },
        { header: 'Repasos', width: 80, align: 'right' },
      ],
      report.trueRetention.rows.map((row) => [
        row.label,
        formatPercent(row.young.retention),
        formatPercent(row.mature.retention),
        formatPercent(row.total.retention),
        formatNumber(row.total.total),
      ]),
    );
  }
  // Lo que queda fuera se dice pase lo que pase: es justo cuando la tabla está vacía cuando
  // más falta hace saber por qué.
  if (report.trueRetention.excludedLearning > 0) {
    // Reserva su hueco: la tabla puede haber dejado el cursor justo en el margen inferior.
    ensure(document, flow, 26);
    flow.page.text(
      MARGIN,
      flow.y + 8,
      `${formatNumber(report.trueRetention.excludedLearning)} respuestas quedan fuera por ser de tarjetas que todavía se estaban aprendiendo.`,
      { size: 8, color: ink.muted },
    );
    flow.y += 18;
  }

  // ── Intervalos de repaso ───────────────────────────────────────────────────
  ensure(document, flow, 200);
  sectionTitle(
    flow,
    'Intervalos de repaso',
    'Cuánto tiempo pasa entre repasos de las tarjetas que ya están en repaso. Describe la biblioteca de hoy, no el periodo.',
  );
  distributionSection(document, flow, report.reviewIntervals, {
    emptyMessage: 'Todavía no hay ninguna tarjeta en repaso.',
    unit: 'tarjetas',
    format: formatIntervalDays,
    sampleLabel: 'Tarjetas en repaso',
  });

  // ── Estabilidad ────────────────────────────────────────────────────────────
  ensure(document, flow, 200);
  sectionTitle(
    flow,
    'Estabilidad',
    'Estimación de cuánto tarda la probabilidad de recordar una tarjeta en bajar hasta cerca del 90 %. Solo entran las tarjetas con historial en el scheduler.',
  );
  distributionSection(document, flow, report.stability, {
    emptyMessage: 'Ninguna tarjeta tiene todavía estabilidad calculada.',
    unit: 'tarjetas',
    format: formatIntervalDays,
    sampleLabel: 'Tarjetas con estado FSRS',
    color: ink.success,
  });

  // ── Dificultad ─────────────────────────────────────────────────────────────
  ensure(document, flow, 200);
  sectionTitle(
    flow,
    'Dificultad',
    'Cuánto cuesta mantener cada tarjeta en memoria según su historial, de 1 a 10. No es el botón Difícil: aquello es una respuesta puntual, esto es una propiedad de la tarjeta.',
  );
  distributionSection(document, flow, report.difficulty, {
    emptyMessage: 'Ninguna tarjeta tiene todavía dificultad calculada.',
    unit: 'tarjetas',
    format: (value) => formatAverage(value),
    sampleLabel: 'Tarjetas con estado FSRS',
    maxLabels: 9,
  });

  // ── Probabilidad de recuerdo ───────────────────────────────────────────────
  ensure(document, flow, 200);
  sectionTitle(
    flow,
    'Probabilidad de recuerdo',
    'Probabilidad estimada de recordar ahora mismo cada tarjeta en repaso. Se calcula en el momento de generar el reporte y no se guarda.',
  );
  distributionSection(document, flow, report.retrievability, {
    emptyMessage: 'Todavía no hay ninguna tarjeta en repaso que medir.',
    unit: 'tarjetas',
    format: (value) => formatPercent(value),
    sampleLabel: 'Tarjetas de repaso',
    color: ink.success,
    maxLabels: 10,
    extreme: 'min',
  });

  // ── Métricas todavía no disponibles ────────────────────────────────────────
  ensure(document, flow, 130);
  sectionTitle(
    flow,
    'Métricas todavía no disponibles',
    'Estadísticas del informe de Anki que esta versión no puede calcular. No se muestran a cero porque el dato no existe.',
  );
  table(
    document,
    flow,
    [
      { header: 'Métrica', width: 130 },
      { header: 'Motivo', width: CONTENT_WIDTH - 130 },
    ],
    report.deferred.map((metric) => [metric.anki, metric.reason]),
  );

  return document.build();
}

/** Nombre de archivo sugerido, sin caracteres que molesten a un sistema de archivos. */
export function reportFileName(report: StatsReport): string {
  const scope =
    report.scope.kind === 'all'
      ? 'todos-los-mazos'
      : report.scopeLabel
          .toLocaleLowerCase()
          .normalize('NFD')
          .replace(/[̀-ͯ]/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '') || 'mazo';
  return `estadisticas-${scope}-${report.period}-${report.today}.pdf`;
}
