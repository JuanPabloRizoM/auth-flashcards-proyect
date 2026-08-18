import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, sizes, spacing, typography } from '../../theme';

export type CardProps = {
  title?: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  /** Si se pasa, la tarjeta entera se convierte en un control pulsable. */
  onPress?: () => void;
  accessibilityLabel?: string;
  testID?: string;
};

export function Card({
  title,
  description,
  children,
  footer,
  onPress,
  accessibilityLabel,
  testID,
}: CardProps) {
  const content = (
    <>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {description ? <Text style={styles.description}>{description}</Text> : null}
      {children ? <View style={styles.body}>{children}</View> : null}
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        accessibilityLabel={accessibilityLabel ?? title}
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [styles.container, styles.pressable, pressed ? styles.pressed : null]}
        testID={testID}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View style={styles.container} testID={testID}>
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: spacing.md,
  },
  container: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.xl,
    width: '100%',
  },
  description: {
    color: colors.textMuted,
    fontSize: typography.size.sm,
    lineHeight: typography.lineHeight.sm,
  },
  footer: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  pressable: {
    justifyContent: 'center',
    minHeight: sizes.touchTarget,
  },
  pressed: {
    backgroundColor: colors.primarySurface,
    borderColor: colors.primary,
  },
  title: {
    color: colors.text,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    lineHeight: typography.lineHeight.lg,
  },
});
