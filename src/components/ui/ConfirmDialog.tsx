import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '../../theme';

import { Button } from './Button';

export type ConfirmDialogProps = {
  visible: boolean;
  title: string;
  /** Qué va a pasar exactamente. Si es irreversible, hay que decirlo aquí. */
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  testID?: string;
};

/**
 * Confirmación de una acción destructiva.
 *
 * Se implementa con `Modal` de React Native y no con `Alert.alert`: `Alert` no está
 * implementado en react-native-web, así que la confirmación no existiría en web ni podría
 * comprobarse en el gate E2E.
 *
 * El fondo es pulsable y cancela, que es lo que la gente espera, pero cancelar nunca es
 * implícito: hay un botón de cancelar visible y es el que recibe el foco visual, no el
 * destructivo.
 */
export function ConfirmDialog({
  visible,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancelar',
  onConfirm,
  onCancel,
  testID,
}: ConfirmDialogProps) {
  return (
    <Modal
      animationType="fade"
      onRequestClose={onCancel}
      transparent
      visible={visible}
    >
      <View style={styles.backdrop}>
        {/*
          Pulsar fuera cancela, que es lo que la gente espera. Pero no se anuncia a los
          lectores de pantalla: si no, habría dos controles llamados "Cancelar", y el que
          ocupa toda la pantalla iría por delante del propio diálogo. El botón de cancelar
          de abajo es el que debe encontrarse.
        */}
        <Pressable
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          onPress={onCancel}
          style={StyleSheet.absoluteFill}
          testID={testID ? `${testID}-backdrop` : undefined}
        />
        <View accessibilityRole="alert" style={styles.dialog} testID={testID}>
          <Text accessibilityRole="header" style={styles.title}>
            {title}
          </Text>
          <Text style={styles.description}>{description}</Text>
          <View style={styles.actions}>
            <Button
              label={cancelLabel}
              onPress={onCancel}
              testID={testID ? `${testID}-cancel` : undefined}
              variant="secondary"
            />
            <Button
              label={confirmLabel}
              onPress={onConfirm}
              testID={testID ? `${testID}-confirm` : undefined}
              variant="danger"
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  actions: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'flex-end',
    marginTop: spacing.sm,
  },
  backdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(32, 36, 42, 0.45)',
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  description: {
    color: colors.textMuted,
    fontSize: typography.size.sm,
    lineHeight: typography.lineHeight.sm,
  },
  dialog: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.sm,
    maxWidth: 420,
    padding: spacing.xl,
    width: '100%',
  },
  title: {
    color: colors.text,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    lineHeight: typography.lineHeight.lg,
  },
});
