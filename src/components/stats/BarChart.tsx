import { StyleSheet, Text, View } from 'react-native';

import { chart, colors, radius, spacing, typography } from '../../theme';

export type BarChartPoint = {
  /** Clave estable de la barra. */
  key: string;
  /** Etiqueta corta del eje. No todas se pintan: ver `labelEvery`. */
  label: string;
  value: number;
  /** Lo que anuncia un lector de pantalla. Lleva el valor en texto, no solo el color. */
  accessibilityLabel: string;
};

export type BarChartProps = {
  points: readonly BarChartPoint[];
  /** Cómo se lee el valor del pico, para rotular el eje vertical. */
  formatPeak: (value: number) => string;
  height?: number;
  /** Rotula una etiqueta de cada `labelEvery`. Con muchas barras se solaparían. */
  labelEvery?: number;
  tone?: 'primary' | 'success';
  emptyMessage: string;
  testID?: string;
};

/**
 * Gráfica de barras.
 *
 * Se dibuja con vistas, sin librería de gráficas. Una barra es un rectángulo con una altura
 * proporcional, y eso funciona igual en web, iOS y Android sin añadir una dependencia ni un
 * motor de renderizado aparte. Traer una librería para dibujar rectángulos sería
 * desproporcionado (docs/CONVENTIONS.md, reglas 2 y 8).
 *
 * Accesibilidad: cada barra es un elemento con su propia etiqueta, que dice la fecha y el
 * valor. Quien no distinga los colores, o no vea la gráfica en absoluto, obtiene el dato
 * igual. La altura nunca es el único portador de información.
 */
export function BarChart({
  points,
  formatPeak,
  height = 120,
  labelEvery,
  tone = 'primary',
  emptyMessage,
  testID,
}: BarChartProps) {
  const total = points.reduce((sum, point) => sum + point.value, 0);

  if (points.length === 0 || total <= 0) {
    return (
      <View style={styles.empty} testID={testID ? `${testID}-empty` : undefined}>
        <Text style={styles.emptyText}>{emptyMessage}</Text>
      </View>
    );
  }

  const peak = points.reduce((max, point) => Math.max(max, point.value), 0);
  const step = labelEvery ?? Math.max(1, Math.ceil(points.length / 6));
  const barColor = tone === 'success' ? chart.barAlternate : chart.bar;

  return (
    <View style={styles.container} testID={testID}>
      <View style={styles.peakRow}>
        <Text style={styles.peak}>{formatPeak(peak)}</Text>
      </View>

      <View accessibilityRole="list" style={[styles.plot, { height }]}>
        {points.map((point, index) => {
          // Las barras con valor mantienen un mínimo visible: un 1 entre 400 no puede
          // quedar en una línea de cero píxeles que parezca ausencia de dato.
          const ratio = point.value / peak;
          const barHeight = point.value > 0 ? Math.max(2, ratio * height) : 0;
          return (
            <View accessibilityLabel={point.accessibilityLabel} key={point.key} style={styles.slot}>
              <View
                style={[
                  styles.bar,
                  { backgroundColor: barColor, height: barHeight },
                  point.value === 0 ? styles.barEmpty : null,
                ]}
              />
              <Text numberOfLines={1} style={styles.tick}>
                {index % step === 0 ? point.label : ''}
              </Text>
            </View>
          );
        })}
      </View>
      <View style={styles.axis} />
    </View>
  );
}

const styles = StyleSheet.create({
  axis: {
    backgroundColor: chart.axis,
    height: 1,
    width: '100%',
  },
  bar: {
    borderTopLeftRadius: radius.sm,
    borderTopRightRadius: radius.sm,
    maxWidth: 28,
    minWidth: 2,
    width: '78%',
  },
  barEmpty: {
    backgroundColor: chart.track,
    height: 1,
  },
  container: {
    gap: spacing.xs,
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
  peak: {
    color: colors.textMuted,
    fontSize: typography.size.xs,
  },
  peakRow: {
    alignItems: 'flex-end',
    width: '100%',
  },
  plot: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 1,
    width: '100%',
  },
  slot: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'flex-end',
    minWidth: 0,
  },
  tick: {
    color: colors.textMuted,
    fontSize: 9,
    marginTop: spacing.xs,
  },
});
