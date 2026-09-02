import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { colors, radius, sizes, spacing, typography } from '../../theme';

import { Message } from './Message';

export type InputProps = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  error?: string;
  helperText?: string;
  testID?: string;
  /**
   * Semántica del campo para el teclado, el autocompletado y los gestores de contraseñas.
   *
   * Se añadió en TASK-008: un formulario de acceso sin `secureTextEntry` enseña la
   * contraseña, y sin `autoComplete` obliga a teclear a mano lo que el sistema ya sabe. Son
   * propiedades del `TextInput` que ya existía, no una variante visual nueva
   * (docs/DESIGN.md: antes de crear un componente, comprobar si uno existente se extiende).
   */
  secureTextEntry?: boolean;
  autoComplete?: TextInputProps['autoComplete'];
  textContentType?: TextInputProps['textContentType'];
  keyboardType?: TextInputProps['keyboardType'];
  autoCapitalize?: TextInputProps['autoCapitalize'];
  autoCorrect?: boolean;
  returnKeyType?: TextInputProps['returnKeyType'];
  onSubmitEditing?: () => void;
};

export function Input({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  helperText,
  testID,
  secureTextEntry,
  autoComplete,
  textContentType,
  keyboardType,
  autoCapitalize,
  autoCorrect,
  returnKeyType,
  onSubmitEditing,
}: InputProps) {
  const hasError = Boolean(error);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        autoCapitalize={autoCapitalize}
        autoComplete={autoComplete}
        autoCorrect={autoCorrect}
        keyboardType={keyboardType}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmitEditing}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        returnKeyType={returnKeyType}
        secureTextEntry={secureTextEntry}
        style={[styles.field, hasError ? styles.fieldError : null]}
        testID={testID}
        textContentType={textContentType}
        value={value}
      />
      {hasError ? (
        <Message testID={testID ? `${testID}-error` : undefined} variant="error">
          {error}
        </Message>
      ) : null}
      {!hasError && helperText ? <Text style={styles.helper}>{helperText}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
    width: '100%',
  },
  field: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    color: colors.text,
    fontSize: typography.size.md,
    minHeight: sizes.controlHeight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    width: '100%',
  },
  fieldError: {
    borderColor: colors.danger,
  },
  helper: {
    color: colors.textMuted,
    fontSize: typography.size.xs,
    lineHeight: typography.lineHeight.xs,
  },
  label: {
    color: colors.text,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
  },
});
