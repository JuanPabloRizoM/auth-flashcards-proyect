import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatSchedulingInterval } from '../../features/scheduler/format';
import {
  reviewRatingHints,
  reviewRatingLabels,
  reviewRatings,
  type ReviewRating,
  type SchedulingPreview,
} from '../../features/scheduler/types';
import { colors, radius, sizes, spacing, typography } from '../../theme';

/**
 * Los cuatro botones de calificación.
 *
 * Solo se montan cuando la respuesta ya está a la vista: calificar algo que no se ha visto
 * no significa nada, y enseñar los botones antes invitaría a hacerlo.
 *
 * Cada botón anuncia el intervalo que produciría, tomado del preview real del scheduler.
 * Ninguno de esos valores está escrito a mano: si el algoritmo cambia, cambian solos.
 *
 * La ayuda bajo cada etiqueta es una línea corta, no un tutorial: existe porque "Difícil"
 * es aprobatorio y eso no se adivina mirando el botón (docs/PRODUCT.md, 2026-08-30).
 */

export type RatingButtonsProps = {
  preview: SchedulingPreview;
  onRate: (rating: ReviewRating) => void;
  /** Mientras se guarda, los cuatro quedan inertes: una respuesta, una escritura. */
  disabled?: boolean;
  testID?: string;
};

/** Clave estable del testID de cada botón. */
export const ratingTestIds: Record<ReviewRating, string> = {
  'otra-vez': 'rate-again',
  dificil: 'rate-hard',
  bien: 'rate-good',
  facil: 'rate-easy',
};

export function RatingButtons({ preview, onRate, disabled = false, testID }: RatingButtonsProps) {
  return (
    <View style={styles.row} testID={testID}>
      {reviewRatings.map((rating) => {
        const label = reviewRatingLabels[rating];
        const interval = formatSchedulingInterval(preview[rating].intervalMs);
        return (
          <Pressable
            accessibilityLabel={`${label}. ${reviewRatingHints[rating]}. Volverá en ${interval}.`}
            accessibilityRole="button"
            accessibilityState={{ disabled }}
            disabled={disabled}
            key={rating}
            onPress={disabled ? undefined : () => onRate(rating)}
            style={({ pressed }) => [
              styles.button,
              rating === 'otra-vez' ? styles.again : null,
              pressed && !disabled ? styles.pressed : null,
              disabled ? styles.disabled : null,
            ]}
            testID={ratingTestIds[rating]}
          >
            <Text style={[styles.label, disabled ? styles.mutedText : null]}>{label}</Text>
            <Text style={[styles.interval, disabled ? styles.mutedText : null]}>{interval}</Text>
            <Text style={styles.hint}>{reviewRatingHints[rating]}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  again: {
    // El único fallo de los cuatro. El rojo apagado está reservado a eso (docs/DESIGN.md).
    borderColor: colors.danger,
  },
  button: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    borderWidth: 1,
    flexBasis: 140,
    flexGrow: 1,
    gap: spacing.xs,
    justifyContent: 'center',
    minHeight: sizes.touchTarget + spacing.xl,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  disabled: {
    backgroundColor: colors.disabledSurface,
    borderColor: colors.disabledSurface,
  },
  hint: {
    color: colors.textMuted,
    fontSize: typography.size.xs,
    lineHeight: typography.lineHeight.xs,
    textAlign: 'center',
  },
  interval: {
    color: colors.primary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
  },
  label: {
    color: colors.text,
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
  },
  mutedText: {
    color: colors.disabled,
  },
  pressed: {
    opacity: 0.85,
  },
  row: {
    alignItems: 'stretch',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    width: '100%',
  },
});
