import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { Card as CardModel } from '../../types/domain';
import { spacing } from '../../theme';
import { Button, Card, FlashcardFace, Input, Message } from '../ui';

export type DeckCardRowProps = {
  card: CardModel;
  /** Devuelve el mensaje de error si la edición no es válida, o `undefined` si se guardó. */
  onSave: (front: string, back: string) => string | undefined;
  onRequestDelete: () => void;
};

/**
 * Una carta dentro del detalle del mazo, con sus dos modos.
 *
 * En reposo enseña frente y reverso; al editar, los mismos dos campos rellenos con lo que ya
 * había. Cancelar descarta el borrador sin tocar nada, que es justamente lo que hay que poder
 * demostrar: el estado editable vive aquí y se tira al salir.
 */
export function DeckCardRow({ card, onSave, onRequestDelete }: DeckCardRowProps) {
  const [editing, setEditing] = useState(false);
  const [front, setFront] = useState(card.front);
  const [back, setBack] = useState(card.back);
  const [error, setError] = useState<string | undefined>(undefined);

  const startEditing = () => {
    // Se parte siempre del contenido guardado, no de un borrador anterior abandonado.
    setFront(card.front);
    setBack(card.back);
    setError(undefined);
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
    setError(undefined);
  };

  const save = () => {
    const message = onSave(front, back);
    if (message !== undefined) {
      setError(message);
      return;
    }
    setEditing(false);
    setError(undefined);
  };

  if (!editing) {
    return (
      <Card
        footer={
          <>
            <Button
              label="Editar"
              onPress={startEditing}
              testID={`edit-card-${card.id}`}
              variant="secondary"
            />
            <Button
              label="Eliminar"
              onPress={onRequestDelete}
              testID={`delete-card-${card.id}`}
              variant="danger"
            />
          </>
        }
        testID={`card-${card.id}`}
      >
        <FlashcardFace label="Frente" text={card.front} />
        <FlashcardFace label="Reverso" text={card.back} tone="back" />
      </Card>
    );
  }

  return (
    <Card testID={`card-${card.id}`} title="Editar carta">
      <Input
        label="Frente"
        onChangeText={(value) => {
          setFront(value);
          setError(undefined);
        }}
        testID={`edit-card-front-${card.id}`}
        value={front}
      />
      <Input
        label="Reverso"
        onChangeText={(value) => {
          setBack(value);
          setError(undefined);
        }}
        testID={`edit-card-back-${card.id}`}
        value={back}
      />
      {error ? (
        <Message testID={`edit-card-error-${card.id}`} variant="error">
          {error}
        </Message>
      ) : null}
      <View style={styles.actions}>
        <Button label="Guardar" onPress={save} testID={`save-card-${card.id}`} />
        <Button
          label="Cancelar"
          onPress={cancelEditing}
          testID={`cancel-card-${card.id}`}
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
