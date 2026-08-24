import { StyleSheet, Text, View } from 'react-native';

import type { CalendarDay } from '../../features/stats/engine';
import { formatDayLong, formatDuration, formatNumber } from '../../features/stats/format';
import { weekdayOfDay } from '../../features/stats/time';
import { chart, colors, radius, spacing, typography } from '../../theme';

export type CalendarHeatmapProps = {
  days: readonly CalendarDay[];
  maxCards: number;
  emptyMessage: string;
  testID?: string;
};

const WEEKDAYS = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

/** Texto que describe un día completo. Es lo que anuncia un lector de pantalla. */
export function describeCalendarDay(day: CalendarDay): string {
  if (day.cards === 0) {
    return `${formatDayLong(day.day)}: sin actividad.`;
  }
  const cards = day.cards === 1 ? '1 tarjeta' : `${formatNumber(day.cards)} tarjetas`;
  const sessions = day.sessions === 1 ? '1 sesión' : `${formatNumber(day.sessions)} sesiones`;
  return `${formatDayLong(day.day)}: ${cards}, ${formatDuration(day.activeMs)}, ${sessions}.`;
}

/**
 * Calendario de actividad.
 *
 * Una columna por semana y una fila por día de la semana, como el mapa de calor del informe
 * de Anki. Se envuelve en varias filas de semanas cuando no caben todas a lo ancho, que es
 * lo que lo hace utilizable en móvil sin desplazamiento horizontal.
 *
 * El color indica intensidad, pero nunca es la única fuente: cada celda lleva una etiqueta
 * accesible con la fecha, las tarjetas, el tiempo y las sesiones de ese día, y la leyenda
 * escribe en palabras qué significan los extremos de la escala.
 */
export function CalendarHeatmap({ days, maxCards, emptyMessage, testID }: CalendarHeatmapProps) {
  if (days.length === 0 || maxCards === 0) {
    return (
      <View style={styles.empty} testID={testID ? `${testID}-empty` : undefined}>
        <Text style={styles.emptyText}>{emptyMessage}</Text>
      </View>
    );
  }

  // Los huecos del principio mantienen alineadas las filas con su día de la semana: sin
  // ellos, un periodo que empieza en miércoles pintaría el miércoles en la fila del domingo.
  const leading = weekdayOfDay(days[0]!.day);

  return (
    <View style={styles.container} testID={testID}>
      <View style={styles.legendRow}>
        <Text style={styles.legendText}>Sin actividad</Text>
        <View style={styles.scale}>
          {chart.calendarScale.map((tone, index) => (
            <View key={tone} style={[styles.swatch, { backgroundColor: tone }]}>
              <Text style={styles.swatchLabel}>{index}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.legendText}>
          Máximo: {formatNumber(maxCards)} {maxCards === 1 ? 'tarjeta' : 'tarjetas'} en un día
        </Text>
      </View>

      <View style={styles.grid}>
        <View style={styles.weekdays}>
          {WEEKDAYS.map((label) => (
            <Text key={label} style={styles.weekday}>
              {label}
            </Text>
          ))}
        </View>

        <View accessibilityRole="list" style={styles.cells}>
          {Array.from({ length: leading }, (_, index) => (
            <View key={`hueco-${index}`} style={[styles.cell, styles.cellSpacer]} />
          ))}
          {days.map((day) => (
            <View
              accessibilityLabel={describeCalendarDay(day)}
              key={day.day}
              style={[
                styles.cell,
                { backgroundColor: chart.calendarScale[day.level] ?? chart.calendarScale[0] },
                day.cards > 0 ? styles.cellActive : null,
              ]}
              testID={testID ? `${testID}-dia-${day.day}` : undefined}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

const CELL = 14;

const styles = StyleSheet.create({
  cell: {
    borderRadius: 3,
    height: CELL,
    width: CELL,
  },
  cellActive: {
    // Un borde marca las celdas con actividad para quien no distinga los tonos de azul.
    borderColor: colors.primary,
    borderWidth: 1,
  },
  cellSpacer: {
    backgroundColor: 'transparent',
  },
  cells: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    flexShrink: 1,
    gap: 3,
    minWidth: 0,
  },
  container: {
    gap: spacing.md,
    width: '100%',
  },
  empty: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    padding: spacing.lg,
    width: '100%',
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: typography.size.sm,
    lineHeight: typography.lineHeight.sm,
  },
  grid: {
    flexDirection: 'row',
    gap: spacing.sm,
    width: '100%',
  },
  legendRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  legendText: {
    color: colors.textMuted,
    fontSize: typography.size.xs,
  },
  scale: {
    flexDirection: 'row',
    gap: 2,
  },
  swatch: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: 3,
    borderWidth: 1,
    height: 14,
    justifyContent: 'center',
    width: 14,
  },
  swatchLabel: {
    color: colors.textMuted,
    fontSize: 8,
  },
  weekday: {
    color: colors.textMuted,
    fontSize: 9,
    height: CELL + 3,
    lineHeight: CELL,
    width: 10,
  },
  weekdays: {
    flexShrink: 0,
  },
});
