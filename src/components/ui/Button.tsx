import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, sizes, spacing, typography } from '../../theme';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

export type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  testID?: string;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  testID,
}: ButtonProps) {
  const isInactive = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isInactive, busy: loading }}
      disabled={isInactive}
      onPress={isInactive ? undefined : onPress}
      style={({ pressed }) => [
        styles.base,
        variantStyles[variant],
        pressed && !isInactive ? styles.pressed : null,
        isInactive ? inactiveStyles[variant] : null,
      ]}
      testID={testID}
    >
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator
            color={variant === 'primary' ? colors.textInverse : colors.primary}
            size="small"
          />
        ) : null}
        <Text style={[styles.label, labelStyles[variant], isInactive ? styles.labelInactive : null]}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: sizes.touchTarget,
    minWidth: sizes.touchTarget,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  content: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
  },
  label: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    textAlign: 'center',
  },
  labelInactive: {
    color: colors.disabled,
  },
  pressed: {
    opacity: 0.85,
  },
});

const variantStyles = StyleSheet.create({
  ghost: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  primary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  secondary: {
    backgroundColor: colors.surface,
    borderColor: colors.borderStrong,
  },
});

const labelStyles = StyleSheet.create({
  ghost: { color: colors.primary },
  primary: { color: colors.textInverse },
  secondary: { color: colors.text },
});

const inactiveStyles = StyleSheet.create({
  ghost: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  primary: {
    backgroundColor: colors.disabledSurface,
    borderColor: colors.disabledSurface,
  },
  secondary: {
    backgroundColor: colors.disabledSurface,
    borderColor: colors.disabledSurface,
  },
});
