import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, sizes, spacing, typography } from '../../theme';

export type ScreenHeaderProps = {
  title: string;
  subtitle?: string;
  /** Vuelta explícita para las pantallas de detalle, que sí se apilan. */
  back?: { label: string; onPress: () => void; testID?: string };
  action?: React.ReactNode;
};

/** Encabezado de pantalla: mismo tratamiento en todas, para no inventar una jerarquía por pantalla. */
export function ScreenHeader({ title, subtitle, back, action }: ScreenHeaderProps) {
  return (
    <View style={styles.container}>
      {back ? (
        <Pressable
          accessibilityRole="button"
          onPress={back.onPress}
          style={styles.back}
          testID={back.testID}
        >
          <Text style={styles.backLabel}>‹ {back.label}</Text>
        </Pressable>
      ) : null}
      <View style={styles.row}>
        <View style={styles.titles}>
          <Text accessibilityRole="header" style={styles.title}>
            {title}
          </Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {action ? <View style={styles.action}>{action}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  action: {
    flexShrink: 0,
  },
  back: {
    alignSelf: 'flex-start',
    borderRadius: radius.md,
    justifyContent: 'center',
    minHeight: sizes.touchTarget,
    paddingRight: spacing.md,
  },
  backLabel: {
    color: colors.primary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
  },
  container: {
    gap: spacing.xs,
    width: '100%',
  },
  row: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: typography.size.sm,
  },
  title: {
    color: colors.text,
    fontSize: typography.size.xxl,
    fontWeight: typography.weight.bold,
    lineHeight: typography.lineHeight.xxl,
  },
  titles: {
    flexGrow: 1,
    flexShrink: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
});
