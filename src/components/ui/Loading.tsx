import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '../../theme';

export type LoadingProps = {
  message?: string;
  testID?: string;
};

/** Estado de carga consistente para toda la aplicación. */
export function Loading({ message = 'Cargando…', testID }: LoadingProps) {
  return (
    <View
      accessibilityLabel={message}
      accessibilityRole="progressbar"
      style={styles.container}
      testID={testID}
    >
      <ActivityIndicator color={colors.primary} size="small" />
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    paddingVertical: spacing.lg,
  },
  message: {
    color: colors.textMuted,
    fontSize: typography.size.sm,
  },
});
