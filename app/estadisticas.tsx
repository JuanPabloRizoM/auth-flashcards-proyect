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
  countMetrics,
  deckComparisonColumns,
  deckComparisonRows,
  deferredColumns,
  deferredRows,
  hourlyBars,
  hourlyMetrics,
  originColumns,
  originRows,
  periodOptions,
  scopeFromValue,
  scopeOptions,
  speedBars,
  speedMetrics,
  streakMetrics,
  timeBars,
  timeMetrics,
  todayMetrics,
  trackingNotice,
} from '../src/features/stats/view';
import { savePdfFile } from '../src/lib/files';
import type { FileSaver } from '../src/lib/files';
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
 * No se muestran Future Due, Review Intervals, Card Ease, Retention ni Answer Buttons:
 * requieren un algoritmo de repetición espaciada que todavía no está decidido. En vez de
 * dibujarlas a cero, se declaran al final con su motivo.
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
};

export default function EstadisticasScreen({
  fileSaver = savePdfFile,
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
  const [today] = useState(() => localDayOf(Date.now()));

  const report = useMemo(
    () =>
      buildStatsReport(
        { library, history },
        { scope: scopeFromValue(activeScopeValue), period, today },
      ),
    [activeScopeValue, history, library, period, today],
  );

  const onGenerate = useCallback(
    async () => {
      setReportFeedback(undefined);
      const generatedAt = Date.now();
      // El PDF nace del mismo motor y de la misma función que el dashboard: solo cambian el
      // ámbito y el periodo que se le piden.
      const pdfReport = buildStatsReport(
        { library, history },
        { scope: scopeFromValue(reportScope), period: reportPeriod, today: localDayOf(generatedAt) },
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
    [fileSaver, history, library, reportPeriod, reportScope],
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
        description="Tarjetas completadas en cada hora local. No incluye tasa de acierto: el estudio todavía no califica."
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
