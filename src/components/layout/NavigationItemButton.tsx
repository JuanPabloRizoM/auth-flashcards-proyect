import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, radius, sizes, spacing, typography } from '../../theme';

import type { NavigationItem } from './navigation';

export type NavigationItemButtonProps = {
  item: NavigationItem;
  active: boolean;
  orientation: 'sidebar' | 'bar';
  onPress: (href: NavigationItem['href']) => void;
};

/**
 * Un único control de navegación reutilizado por el sidebar y por la barra compacta,
 * para no duplicar estilos ni comportamiento entre las dos disposiciones.
 */
export function NavigationItemButton({
  item,
  active,
  orientation,
  onPress,
}: NavigationItemButtonProps) {
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityState={{ selected: active }}
      // `accessibilityState.selected` funciona en iOS y Android, pero react-native-web no
      // lo traduce a nada para un elemento con rol de enlace: en el navegador el destino
      // activo quedaría marcado solo por su color de fondo. `aria-current` es la forma
      // estándar de decir "estás aquí" en web, y sí se propaga al DOM.
      aria-current={active ? 'page' : undefined}
      onPress={() => onPress(item.href)}
      style={[
        styles.base,
        orientation === 'sidebar' ? styles.sidebar : styles.bar,
        active ? styles.active : null,
      ]}
      testID={item.testID}
    >
      <Text style={[styles.label, active ? styles.labelActive : null]}>{item.label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  active: {
    backgroundColor: colors.primarySurface,
  },
  bar: {
    flex: 1,
  },
  base: {
    alignItems: 'center',
    borderRadius: radius.md,
    justifyContent: 'center',
    minHeight: sizes.touchTarget,
    minWidth: sizes.touchTarget,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  label: {
    color: colors.textMuted,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
  },
  labelActive: {
    color: colors.primary,
    fontWeight: typography.weight.semibold,
  },
  sidebar: {
    alignItems: 'flex-start',
    width: '100%',
  },
});
