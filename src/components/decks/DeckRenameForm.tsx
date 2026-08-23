import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { spacing } from '../../theme';
import { Button, Card, Input } from '../ui';

export type DeckRenameFormProps = {
  currentName: string;
  /** Devuelve el mensaje de error si el nombre no vale, o `undefined` si se guardó. */
  onSave: (name: string) => string | undefined;
  onCancel: () => void;
};

/**
 * Formulario de renombrado, precargado con el nombre actual.
 *
 * El borrador vive aquí dentro y desaparece al cancelar, así que cancelar no puede dejar a
 * medias ni el nombre ni el mensaje de error.
 */
export function DeckRenameForm({ currentName, onSave, onCancel }: DeckRenameFormProps) {
  const [name, setName] = useState(currentName);
  const [error, setError] = useState<string | undefined>(undefined);

  const save = () => {
    const message = onSave(name);
    if (message !== undefined) {
      setError(message);
    }
  };

  return (
    <Card title="Renombrar mazo">
      <Input
        error={error}
        label="Nombre del mazo"
        onChangeText={(value) => {
          setName(value);
          setError(undefined);
        }}
        placeholder="Nombre del mazo"
        testID="rename-deck-input"
        value={name}
      />
      <View style={styles.actions}>
        <Button label="Guardar" onPress={save} testID="rename-deck-save" />
        <Button
          label="Cancelar"
          onPress={onCancel}
          testID="rename-deck-cancel"
          variant="secondary"
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  actions: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});
