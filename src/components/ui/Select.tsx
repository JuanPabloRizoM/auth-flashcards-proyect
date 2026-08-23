import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, sizes, spacing, typography } from '../../theme';

export type SelectOption<T extends string | number> = {
  value: T;
  label: string;
};

export type SelectProps<T extends string | number> = {
  label: string;
  options: readonly SelectOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
  /** Qué se muestra cuando todavía no hay nada elegido. */
  placeholder?: string;
  error?: string;
  testID?: string;
};

/**
 * Elección entre unas pocas opciones, resuelta como una fila de opciones visibles.
 *
 * React Native no trae un desplegable propio y añadir una dependencia para pintar un menú
 * sería desproporcionado: aquí las listas son cortas (cuatro órdenes, las hojas de un libro,
 * las columnas de una tabla) y mostrarlas todas es además más rápido de usar y más fácil de
 * alcanzar con el dedo que un desplegable.
 *
 * Cada opción es un botón real con `accessibilityState.selected`, así que un lector de
 * pantalla anuncia cuál está activa.
 */
export function Select<T extends string | number>({
  label,
  options,
  value,
  onChange,
  placeholder,
  error,
  testID,
}: SelectProps<T>) {
  const nothingChosen = value === null;

  return (
    <View style={styles.container} testID={testID}>
      <Text style={styles.label}>{label}</Text>
      {nothingChosen && placeholder ? <Text style={styles.placeholder}>{placeholder}</Text> : null}
      <View accessibilityRole="radiogroup" style={styles.options}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              accessibilityLabel={`${label}: ${option.label}`}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              key={String(option.value)}
              onPress={() => onChange(option.value)}
              style={[styles.option, selected ? styles.optionSelected : null]}
              testID={testID ? `${testID}-${option.value}` : undefined}
            >
              <Text style={[styles.optionLabel, selected ? styles.optionLabelSelected : null]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {error ? (
        <Text
          accessibilityRole="alert"
          style={styles.error}
          testID={testID ? `${testID}-error` : undefined}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
    width: '100%',
  },
  error: {
    color: colors.danger,
    fontSize: typography.size.xs,
    lineHeight: typography.lineHeight.xs,
  },
  label: {
    color: colors.text,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
  },
  option: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: sizes.touchTarget,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  optionLabel: {
    color: colors.textMuted,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
  },
  optionLabelSelected: {
    color: colors.primary,
    fontWeight: typography.weight.semibold,
  },
  optionSelected: {
    backgroundColor: colors.primarySurface,
    borderColor: colors.primary,
  },
  options: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  placeholder: {
    color: colors.textMuted,
    fontSize: typography.size.xs,
    lineHeight: typography.lineHeight.xs,
  },
});
