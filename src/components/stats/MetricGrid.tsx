import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '../../theme';

export type Metric = {
  label: string;
  value: string;
  /** Aclaración corta bajo la cifra: unidades, salvedades o de qué se ha calculado. */
  hint?: string;
};

export type MetricGridProps = {
  metrics: readonly Metric[];
  testID?: string;
};

/**
 * Rejilla de cifras.
 *
 * Envuelve sola: en desktop caben tres o cuatro por fila y en móvil una o dos, sin
 * necesidad de dos disposiciones distintas. Cada casilla es un elemento con etiqueta
 * accesible completa, de modo que un lector de pantalla anuncie "Tarjetas estudiadas: 44"
 * y no dos textos sueltos.
 */
export function MetricGrid({ metrics, testID }: MetricGridProps) {
  return (
    <View accessibilityRole="list" style={styles.grid} testID={testID}>
      {metrics.map((metric) => (
        <View
          accessibilityLabel={`${metric.label}: ${metric.value}`}
          key={metric.label}
          style={styles.cell}
          testID={testID ? `${testID}-${slug(metric.label)}` : undefined}
        >
          <Text style={styles.label}>{metric.label}</Text>
          <Text style={styles.value}>{metric.value}</Text>
          {metric.hint ? <Text style={styles.hint}>{metric.hint}</Text> : null}
        </View>
      ))}
    </View>
  );
}

/** Clave estable para el testID a partir de la etiqueta. */
function slug(label: string): string {
  return label
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const styles = StyleSheet.create({
  cell: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexBasis: 150,
    flexGrow: 1,
    gap: spacing.xs,
    minWidth: 0,
    padding: spacing.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    width: '100%',
  },
  hint: {
    color: colors.textMuted,
    fontSize: typography.size.xs,
    lineHeight: typography.lineHeight.xs,
  },
  label: {
    color: colors.textMuted,
    fontSize: typography.size.xs,
    letterSpacing: typography.letterSpacing.label,
    textTransform: 'uppercase',
  },
  value: {
    color: colors.text,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
  },
});
