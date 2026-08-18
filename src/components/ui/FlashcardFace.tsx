import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, sizes, spacing, typography } from '../../theme';

export type FlashcardFaceProps = {
  label: string;
  text: string;
  /** `prompt` para el frente en estudio; `compact` para listados. */
  size?: 'prompt' | 'compact';
  tone?: 'front' | 'back';
  testID?: string;
};

/**
 * Contenido de una flashcard.
 *
 * Único punto donde se usa la serif: es lo que se estudia, no interfaz
 * (docs/DESIGN.md, sección Tipografía).
 */
export function FlashcardFace({
  label,
  text,
  size = 'compact',
  tone = 'front',
  testID,
}: FlashcardFaceProps) {
  return (
    <View style={styles.container} testID={testID}>
      <Text style={styles.label}>{label}</Text>
      <Text
        style={[
          styles.content,
          size === 'prompt' ? styles.prompt : styles.compact,
          tone === 'back' ? styles.back : null,
        ]}
      >
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  back: {
    color: colors.primary,
  },
  compact: {
    fontSize: typography.size.md,
    lineHeight: typography.lineHeight.md,
  },
  container: {
    gap: spacing.xs,
    width: '100%',
  },
  content: {
    color: colors.text,
    fontFamily: typography.family.serif,
  },
  label: {
    color: colors.textMuted,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    letterSpacing: typography.letterSpacing.label,
    textTransform: 'uppercase',
  },
  prompt: {
    fontSize: typography.size.xl,
    lineHeight: typography.lineHeight.xl,
    textAlign: 'center',
  },
});

/** Contenedor visual de la carta en la pantalla de estudio. */
export function FlashcardSurface({
  children,
  testID,
}: {
  children: React.ReactNode;
  testID?: string;
}) {
  return (
    <View style={surfaceStyles.surface} testID={testID}>
      {children}
    </View>
  );
}

const surfaceStyles = StyleSheet.create({
  surface: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.xl,
    justifyContent: 'center',
    minHeight: sizes.studyCardMinHeight,
    padding: spacing.xl,
    width: '100%',
  },
});
