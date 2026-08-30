import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ScreenHeader } from '../src/components/layout';
import { BarChart, CalendarHeatmap, MetricGrid, StatsTable } from '../src/components/stats';
import { Button, Card, EmptyState, Loading, Message, Select } from '../src/components/ui';
import { buildStatsReport } from '../src/features/stats/engine';
import { formatDayLong, formatDuration, formatNumber, formatSeconds } from '../src/features/stats/format';
import { buildStatsPdf, reportFileName } from '../src/features/stats/pdf/report';
import { localDayOf } from '../src/features/stats/time';
import type { StatsPeriod } from '../src/features/stats/types';
import {
  activityBars,
  activityMetrics,
  addedBars,
  addedMetrics,
  ALL_DECKS,
  answerButtonBars,
  answerButtonMetrics,
  countMetrics,
  deckComparisonColumns,
  deckComparisonRows,
  deferredColumns,
  deferredRows,
  difficultyBars,
  difficultyMetrics,
  futureDueBars,
  futureDueHorizonLabel,
  futureDueMetrics,
  hourlyBars,
  hourlyMetrics,
  originColumns,
  originRows,
  periodOptions,
  ratingNotice,
  retentionColumns,
  retentionExclusionNotice,
  retentionRows,
  retrievabilityBars,
  retrievabilityMetrics,
  reviewIntervalBars,
  reviewIntervalMetrics,
  schedulerCountMetrics,
  scopeFromValue,
  scopeOptions,
  speedBars,
  speedMetrics,
  stabilityBars,
  stabilityMetrics,
  streakMetrics,
  timeBars,
  timeMetrics,
  todayMetrics,
  trackingNotice,
} from '../src/features/stats/view';
import { savePdfFile } from '../src/lib/files';
import type { FileSaver } from '../src/lib/files';
import { systemClock, type Clock } from '../src/lib/clock';
import { useLibrary } from '../src/lib/LibraryProvider';
import { useStudyHistory } from '../src/lib/StudyHistoryProvider';
import { spacing } from '../src/theme';

/**
 * Estadísticas.
 *
 * La pantalla no calcula nada: pide un informe al motor con el ámbito y el periodo
 * elegidos, y lo pinta (docs/ARCHITECTURE.md, regla 1). El reporte PDF pide exactamente el
 * mismo informe, de modo que no puedan discrepar.
 *
 * Desde TASK-007 hay un scheduler real, así que aparecen también Future Due, Answer
 * Buttons, True Retention, Review Intervals, Stability, Difficulty y Retrievability. Todas
 * se derivan de datos reales del scheduler y del registro de calificaciones; ninguna se
 * dibuja a cero cuando el dato no existe.
 */
export type EstadisticasScreenProps = {
  /**
   * Puerto de guardado inyectable.
   *
   * Mismo patrón que el selector de archivos de la pantalla de importación: en producción
   * es la descarga del navegador o la hoja de compartir del sistema, y en un test es un
   * doble que se queda con los bytes para poder afirmar sobre el PDF de verdad.
   */
  fileSaver?: FileSaver;
  /**
   * Reloj inyectable.
   *
   * La retrievability y Future Due se miden en el instante actual, no en el día: un test
   * necesita poder fijarlo y adelantarlo para comprobar que la probabilidad de recuerdo
   * baja con el tiempo.
   */
  clock?: Clock;
};

export default function EstadisticasScreen({
  fileSaver = savePdfFile,
  clock = systemClock,
}: EstadisticasScreenProps = {}) {
  const { library, status: libraryStatus, storageError } = useLibrary();
  const { history, status: historyStatus, historyError } = useStudyHistory();

  const [scopeValue, setScopeValue] = useState<string>(ALL_DECKS);
  const [period, setPeriod] = useState<StatsPeriod>('1m');

  const [reportOpen, setReportOpen] = useState(false);
  const [reportScope, setReportScope] = useState<string>(ALL_DECKS);
  const [reportPeriod, setReportPeriod] = useState<StatsPeriod>('1m');
  const [reportFeedback, setReportFeedback] = useState<
    { variant: 'success' | 'error'; text: string } | undefined
  >(undefined);

  const hydrating = libraryStatus === 'loading' || historyStatus === 'loading';

  const decks = library.decks;
  const options = useMemo(() => scopeOptions(decks), [decks]);

  // Si el mazo elegido desaparece de la biblioteca, el selector vuelve a "Todos los mazos":
  // dejar seleccionado un valor que ya no está en la lista sería un estado imposible.
  const activeScopeValue =
    scopeValue !== ALL_DECKS && !decks.some((deck) => deck.id === scopeValue)
      ? ALL_DECKS
      : scopeValue;

  /**
   * Hoy, fijado al montar la pantalla.
   *
   * Leer el reloj en cada renderizado haría que el mismo estado produjera informes
   * distintos. Se lee una vez, en la inicialización perezosa del estado. La consecuencia
   * es que una pantalla abierta cuando cambia el día sigue mostrando el día anterior hasta
   * que se vuelve a entrar, que es preferible a que las cifras bailen solas.
   */
  const [now] = useState(() => clock.now());
  const [today] = useState(() => localDayOf(now));

  const report = useMemo(
    () =>
      buildStatsReport(
        { library, history },
        { scope: scopeFromValue(activeScopeValue), period, today, now },
      ),
    [activeScopeValue, history, library, now, period, today],
  );

  const onGenerate = useCallback(
    async () => {
      setReportFeedback(undefined);
      const generatedAt = clock.now();
      // El PDF nace del mismo motor y de la misma función que el dashboard: solo cambian el
      // ámbito y el periodo que se le piden.
      const pdfReport = buildStatsReport(
        { library, history },
        {
          scope: scopeFromValue(reportScope),
          period: reportPeriod,
          today: localDayOf(generatedAt),
          now: generatedAt,
        },
      );
      const bytes = buildStatsPdf(pdfReport, { generatedAt });
      const result = await fileSaver(reportFileName(pdfReport), bytes);

      if (result.status === 'error') {
        setReportFeedback({ variant: 'error', text: result.message });
        return;
      }
      const where =
        result.where === 'descarga'
          ? 'Se ha descargado el reporte.'
          : result.where === 'compartido'
            ? 'Se ha abierto la hoja para guardar o compartir el reporte.'
            : `Se ha guardado el reporte en ${result.uri ?? 'este dispositivo'}.`;
      setReportFeedback({
        variant: 'success',
        text: `${where} Ámbito: ${pdfReport.scopeLabel}. Periodo: ${pdfReport.periodLabel}.`,
      });
    },
    [clock, fileSaver, history, library, reportPeriod, reportScope],
  );

  if (hydrating) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Estadísticas" />
        <Loading message="Recuperando tu historial de estudio…" testID="stats-loading" />
      </View>
    );
  }

  const hasCalendar = report.calendar.maxCards > 0;

  return (
    <View style={styles.container}>
      <ScreenHeader subtitle={trackingNotice(report)} title="Estadísticas" />

      {storageError ? (
        <Message testID="storage-error" title="Problema con el almacenamiento" variant="error">
          {storageError}
        </Message>
      ) : null}
      {historyError ? (
        <Message testID="history-error" title="Problema con el historial" variant="error">
          {historyError}
        </Message>
      ) : null}

      <Card title="Ámbito y periodo">
        <Select
          label="Mazo"
          onChange={setScopeValue}
          options={options}
          testID="stats-scope"
          value={activeScopeValue}
        />
        <Select
          label="Periodo"
          onChange={setPeriod}
          options={periodOptions}
          testID="stats-period"
          value={period}
        />
      </Card>

      {report.empty ? (
        <EmptyState
          description={
            report.scope.kind === 'all'
              ? 'Cuando estudies un mazo, aquí aparecerán tus tarjetas, tu tiempo y tu racha. No se inventa actividad anterior.'
              : 'Este mazo no tiene actividad registrada en el periodo elegido. Prueba con un periodo más amplio.'
          }
          testID="stats-empty"
          title="Sin actividad en este periodo"
        />
      ) : null}

      <Card
        description={formatDayLong(report.today)}
        testID="stats-today"
        title="Hoy"
      >
        <MetricGrid metrics={todayMetrics(report)} testID="stats-today-metrics" />
      </Card>

      <Card
        description="Cuántas tarjetas se completaron cada día del periodo."
        testID="stats-activity"
        title="Tarjetas estudiadas por día"
      >
        <BarChart
          emptyMessage="Sin tarjetas estudiadas en este periodo."
          formatPeak={(value) => `${formatNumber(value)} tarjetas`}
          points={activityBars(report)}
          testID="stats-activity-chart"
        />
        <MetricGrid metrics={activityMetrics(report)} testID="stats-activity-metrics" />
      </Card>

      <Card
        description={
          hasCalendar
            ? `Del ${formatDayLong(report.calendar.fromDay)} al ${formatDayLong(report.calendar.toDay)}. La intensidad es el número de tarjetas estudiadas ese día.`
            : 'La intensidad representa el número de tarjetas estudiadas cada día.'
        }
        testID="stats-calendar"
        title="Calendario de actividad"
      >
        <CalendarHeatmap
          days={report.calendar.days}
          emptyMessage="Sin actividad registrada en este periodo."
          maxCards={report.calendar.maxCards}
          testID="stats-calendar-heatmap"
        />
      </Card>

      <Card
        description="Tiempo activo por día. El tiempo con la pestaña o la aplicación en segundo plano no cuenta."
        testID="stats-time"
        title="Tiempo de estudio"
      >
        <BarChart
          emptyMessage="Sin tiempo de estudio registrado en este periodo."
          formatPeak={(value) => formatDuration(value * 60000)}
          points={timeBars(report)}
          testID="stats-time-chart"
          tone="success"
        />
        <MetricGrid metrics={timeMetrics(report)} testID="stats-time-metrics" />
      </Card>

      <Card
        description="Segundos por tarjeta. Solo aparecen los días en los que se completó alguna."
        testID="stats-speed"
        title="Velocidad"
      >
        <BarChart
          emptyMessage="Sin datos de velocidad: no se ha completado ninguna tarjeta en este periodo."
          formatPeak={(value) => formatSeconds(value)}
          points={speedBars(report)}
          testID="stats-speed-chart"
        />
        <MetricGrid metrics={speedMetrics(report)} testID="stats-speed-metrics" />
      </Card>

      <Card
        description="Un día cuenta si se completó al menos una tarjeta."
        testID="stats-streak"
        title="Racha"
      >
        <MetricGrid metrics={streakMetrics(report)} testID="stats-streak-metrics" />
      </Card>

      <Card
        description="Tarjetas completadas en cada hora local. El acierto por hora no se desglosa aquí: para eso están Calificaciones y Retención real."
        testID="stats-hourly"
        title="Actividad por hora"
      >
        <BarChart
          emptyMessage="Sin actividad por hora en este periodo."
          formatPeak={(value) => `${formatNumber(value)} tarjetas`}
          labelEvery={3}
          points={hourlyBars(report)}
          testID="stats-hourly-chart"
        />
        <MetricGrid metrics={hourlyMetrics(report)} testID="stats-hourly-metrics" />
      </Card>

      <Card
        description="Estado actual de la biblioteca en este ámbito. No depende del periodo elegido."
        testID="stats-counts"
        title="Conteo de tarjetas"
      >
        <MetricGrid metrics={countMetrics(report)} testID="stats-counts-metrics" />
        <MetricGrid metrics={schedulerCountMetrics(report)} testID="stats-scheduler-counts" />
      </Card>

      <Card
        description={`${futureDueHorizonLabel(report)} Las tarjetas nuevas no aparecen: todavía no tienen fecha.`}
        testID="stats-future-due"
        title="Próximos repasos"
      >
        <BarChart
          emptyMessage="No hay ningún repaso programado en este horizonte."
          formatPeak={(value) => `${formatNumber(value)} repasos`}
          points={futureDueBars(report)}
          testID="stats-future-due-chart"
        />
        <MetricGrid metrics={futureDueMetrics(report)} testID="stats-future-due-metrics" />
      </Card>

      <Card
        description="Cuántas veces has usado cada calificación en el periodo. La actividad anterior a la calificación se cuenta aparte, nunca como una quinta opción."
        testID="stats-answer-buttons"
        title="Calificaciones"
      >
        {report.answerButtons.total === 0 ? (
          <Message testID="stats-answer-buttons-empty" variant="info">
            {ratingNotice(report)}
          </Message>
        ) : (
          <>
            <BarChart
              emptyMessage="Sin calificaciones en este periodo."
              formatPeak={(value) => `${formatNumber(value)} respuestas`}
              labelEvery={1}
              points={answerButtonBars(report)}
              testID="stats-answer-buttons-chart"
            />
            <MetricGrid
              metrics={answerButtonMetrics(report)}
              testID="stats-answer-buttons-metrics"
            />
          </>
        )}
      </Card>

      <Card
        description="Porcentaje de repasos acertados. Otra vez es un fallo; Difícil, Bien y Fácil son aciertos. Se cuenta el primer repaso de cada tarjeta en cada día, y solo el de tarjetas que ya estaban en repaso."
        testID="stats-retention"
        title="Retención real"
      >
        {report.trueRetention.rows.every((row) => row.total.total === 0) ? (
          <Message testID="stats-retention-empty" variant="info">
            {ratingNotice(report)}
          </Message>
        ) : (
          <StatsTable
            columns={retentionColumns}
            emptyMessage="Sin repasos calificados todavía."
            rows={retentionRows(report)}
            testID="stats-retention-table"
          />
        )}
        {/* Lo que queda fuera se dice pase lo que pase: es justo cuando la tabla está
            vacía cuando más falta hace saber por qué. */}
        {retentionExclusionNotice(report) ? (
          <Message testID="stats-retention-excluded" variant="info">
            {retentionExclusionNotice(report)}
          </Message>
        ) : null}
      </Card>

      <Card
        description="Cuánto tiempo pasa entre repasos de las tarjetas que ya están en repaso. Describe la biblioteca de hoy, no el periodo."
        testID="stats-intervals"
        title="Intervalos de repaso"
      >
        <BarChart
          emptyMessage="Todavía no hay ninguna tarjeta en repaso."
          formatPeak={(value) => `${formatNumber(value)} tarjetas`}
          labelEvery={2}
          points={reviewIntervalBars(report)}
          testID="stats-intervals-chart"
        />
        <MetricGrid metrics={reviewIntervalMetrics(report)} testID="stats-intervals-metrics" />
      </Card>

      <Card
        description="Estimación de cuánto tarda la probabilidad de recordar una tarjeta en bajar hasta cerca del 90 %. Solo entran las tarjetas que ya tienen historial con el scheduler."
        testID="stats-stability"
        title="Estabilidad"
      >
        <BarChart
          emptyMessage="Ninguna tarjeta tiene todavía estabilidad calculada."
          formatPeak={(value) => `${formatNumber(value)} tarjetas`}
          labelEvery={2}
          points={stabilityBars(report)}
          testID="stats-stability-chart"
          tone="success"
        />
        <MetricGrid metrics={stabilityMetrics(report)} testID="stats-stability-metrics" />
      </Card>

      <Card
        description="Cuánto cuesta mantener cada tarjeta en memoria según su historial de repasos, de 1 a 10. No es el botón Difícil: aquello es una respuesta puntual, esto es una propiedad de la tarjeta."
        testID="stats-difficulty"
        title="Dificultad"
      >
        <BarChart
          emptyMessage="Ninguna tarjeta tiene todavía dificultad calculada."
          formatPeak={(value) => `${formatNumber(value)} tarjetas`}
          labelEvery={1}
          points={difficultyBars(report)}
          testID="stats-difficulty-chart"
        />
        <MetricGrid metrics={difficultyMetrics(report)} testID="stats-difficulty-metrics" />
      </Card>

      <Card
        description="Probabilidad estimada de que recuerdes ahora mismo cada tarjeta en repaso. Se calcula al abrir la pantalla y no se guarda: depende del tiempo transcurrido."
        testID="stats-retrievability"
        title="Probabilidad de recuerdo"
      >
        <BarChart
          emptyMessage="Todavía no hay ninguna tarjeta en repaso que medir."
          formatPeak={(value) => `${formatNumber(value)} tarjetas`}
          labelEvery={2}
          points={retrievabilityBars(report)}
          testID="stats-retrievability-chart"
          tone="success"
        />
        <MetricGrid
          metrics={retrievabilityMetrics(report)}
          testID="stats-retrievability-metrics"
        />
      </Card>

      <Card
        description="Altas registradas desde que hay tracking. Las tarjetas anteriores no tienen fecha de alta y se cuentan aparte."
        testID="stats-added"
        title="Tarjetas añadidas"
      >
        <BarChart
          emptyMessage="Ninguna tarjeta añadida en este periodo."
          formatPeak={(value) => `${formatNumber(value)} tarjetas`}
          points={addedBars(report)}
          testID="stats-added-chart"
          tone="success"
        />
        <MetricGrid metrics={addedMetrics(report)} testID="stats-added-metrics" />
      </Card>

      {report.deckComparison !== null ? (
        <Card
          description="Actividad de cada mazo en el periodo seleccionado."
          testID="stats-decks"
          title="Comparación de mazos"
        >
          <StatsTable
            columns={deckComparisonColumns}
            emptyMessage="Ningún mazo registra actividad en este periodo."
            rows={deckComparisonRows(report)}
            testID="stats-decks-table"
          />
        </Card>
      ) : null}

      <Card
        description="De dónde salieron las tarjetas que existen hoy en este ámbito."
        testID="stats-origin"
        title="Origen de las tarjetas"
      >
        <StatsTable
          columns={originColumns}
          emptyMessage="No hay tarjetas en este ámbito."
          rows={originRows(report)}
          testID="stats-origin-table"
        />
      </Card>

      <Card testID="stats-report" title="Reporte PDF">
        {reportOpen ? (
          <>
            <Select
              label="Ámbito del reporte"
              onChange={setReportScope}
              options={options}
              testID="report-scope"
              value={reportScope}
            />
            <Select
              label="Periodo del reporte"
              onChange={setReportPeriod}
              options={periodOptions}
              testID="report-period"
              value={reportPeriod}
            />
            <Button
              label="Descargar reporte"
              onPress={() => void onGenerate()}
              testID="report-confirm"
            />
            <Button
              label="Cancelar"
              onPress={() => setReportOpen(false)}
              testID="report-cancel"
              variant="secondary"
            />
          </>
        ) : (
          <Button
            label="Generar reporte PDF"
            onPress={() => {
              // La configuración parte de lo que se está viendo: es lo que casi siempre se
              // quiere exportar, y sigue pudiéndose cambiar antes de generar.
              setReportScope(activeScopeValue);
              setReportPeriod(period);
              setReportFeedback(undefined);
              setReportOpen(true);
            }}
            testID="report-open"
          />
        )}
        {reportFeedback ? (
          <Message
            testID="report-feedback"
            variant={reportFeedback.variant}
          >
            {reportFeedback.text}
          </Message>
        ) : null}
      </Card>

      <Card
        description="Estadísticas del informe de Anki que esta versión no puede calcular. No se muestran a cero porque el dato no existe."
        testID="stats-deferred"
        title="Métricas todavía no disponibles"
      >
        <StatsTable
          columns={deferredColumns}
          emptyMessage="Todas las métricas están disponibles."
          rows={deferredRows(report)}
          testID="stats-deferred-table"
        />
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xl,
    width: '100%',
  },
});
