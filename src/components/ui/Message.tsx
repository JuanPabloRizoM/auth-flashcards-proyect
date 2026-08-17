import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '../../theme';

export type MessageVariant = 'info' | 'success' | 'error';

export type MessageProps = {
  variant?: MessageVariant;
  title?: string;
  children: ReactNode;
  testID?: string;
};

/**
 * Forma única de mostrar mensajes y errores al usuario.
 * Los errores se anuncian con accessibilityRole="alert" para lectores de pantalla.
 */
export function Message({ variant = 'info', title, children, testID }: MessageProps) {
  const isError = variant === 'error';

  return (
    <View
      accessibilityRole={isError ? 'alert' : undefined}
      // Un error se anuncia como una sola unidad; el resto de variantes se leen normalmente.
      accessible={isError}
      style={[styles.base, surfaceStyles[variant]]}
      testID={testID}
    >
      {title ? <Text style={[styles.title, textStyles[variant]]}>{title}</Text> : null}
      <Text style={[styles.body, textStyles[variant]]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderLeftWidth: 3,
    borderRadius: radius.md,
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  body: {
    fontSize: typography.size.sm,
    lineHeight: typography.lineHeight.sm,
  },
  title: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    lineHeight: typography.lineHeight.sm,
  },
});

const surfaceStyles = StyleSheet.create({
  error: {
    backgroundColor: colors.dangerSurface,
    borderLeftColor: colors.danger,
  },
  info: {
    backgroundColor: colors.infoSurface,
    borderLeftColor: colors.info,
  },
  success: {
    backgroundColor: colors.successSurface,
    borderLeftColor: colors.success,
  },
});

const textStyles = StyleSheet.create({
  error: { color: colors.danger },
  info: { color: colors.info },
  success: { color: colors.success },
});
