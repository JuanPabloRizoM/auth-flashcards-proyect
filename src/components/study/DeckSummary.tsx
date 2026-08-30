import { StyleSheet, Text, View } from 'react-native';

import type { DeckStudySummary } from '../../features/study/queue';
import { colors, radius, spacing, typography } from '../../theme';

/**
 * Resumen de estudio de un mazo: Nuevas, Aprendiendo y Repasar.
 *
 * Los tres números salen del estado del scheduler, nunca de la posición de las cartas en la
 * lista. Describen exactamente lo que la sesión mostraría si se empezara ahora: "Repasar 14"
 * significa catorce cartas de repaso ya vencidas, no catorce cartas de repaso en total
 * (docs/PRODUCT.md, 2026-08-30).
 */

export type DeckSummaryProps = {
  summary: DeckStudySummary;
  testID?: string;
};

const entries = [
  { key: 'nuevas', label: 'Nuevas', tone: 'primary' as const },
  { key: 'aprendiendo', label: 'Aprendiendo', tone: 'warning' as const },
  { key: 'repasar', label: 'Repasar', tone: 'success' as const },
];

export function DeckSummary({ summary, testID }: DeckSummaryProps) {
  const values: Record<string, number> = {
    nuevas: summary.nuevas,
    aprendiendo: summary.aprendiendo,
    repasar: summary.repasar,
  };

  return (
    <View style={styles.container} testID={testID}>
      <View accessibilityRole="list" style={styles.row}>
        {entries.map((entry) => (
          <View
            accessibilityLabel={`${entry.label}: ${values[entry.key]}`}
            key={entry.key}
            style={styles.cell}
            testID={testID ? `${testID}-${entry.key}` : undefined}
          >
            <Text style={styles.label}>{entry.label}</Text>
            <Text style={[styles.value, toneStyles[entry.tone]]}>{values[entry.key]}</Text>
          </View>
        ))}
      </View>
      {summary.aprendiendoMasTarde > 0 ? (
        <Text style={styles.note} testID={testID ? `${testID}-later` : undefined}>
          {summary.aprendiendoMasTarde === 1
            ? 'Hay 1 tarjeta en aprendizaje cuyo turno llega dentro de unos minutos.'
            : `Hay ${summary.aprendiendoMasTarde} tarjetas en aprendizaje cuyo turno llega dentro de unos minutos.`}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  cell: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexBasis: 110,
    flexGrow: 1,
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  container: {
    gap: spacing.sm,
    width: '100%',
  },
  label: {
    color: colors.textMuted,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
    letterSpacing: typography.letterSpacing.label,
    textTransform: 'uppercase',
  },
  note: {
    color: colors.textMuted,
    fontSize: typography.size.sm,
    lineHeight: typography.lineHeight.sm,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    width: '100%',
  },
  value: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
  },
});

const toneStyles = StyleSheet.create({
  primary: { color: colors.primary },
  success: { color: colors.success },
  warning: { color: colors.warning },
});
