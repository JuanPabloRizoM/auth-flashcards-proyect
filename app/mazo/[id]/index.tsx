import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ScreenHeader } from '../../../src/components/layout';
import { Button, Card, EmptyState, FlashcardFace, Input, Message } from '../../../src/components/ui';
import { cardsOfDeck, findDeck, libraryErrorMessage } from '../../../src/features/decks/library';
import { useLibrary } from '../../../src/lib/LibraryProvider';
import { goBackOr } from '../../../src/lib/navigation';
import { spacing } from '../../../src/theme';

/** Detalle de un mazo: sus cartas y el formulario para añadir una nueva. */
export default function DetalleMazoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { library, addCard } = useLibrary();

  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  /** El error se ancla al campo que lo provoca, no a un campo cualquiera del formulario. */
  const [error, setError] = useState<{ field: 'front' | 'back' | 'form'; message: string } | null>(
    null,
  );

  const deckId = id ?? '';
  const deck = findDeck(library, deckId);
  const goToDecks = () => goBackOr(router, () => router.replace('/'));

  if (!deck) {
    return (
      <View style={styles.container}>
        <ScreenHeader
          back={{ label: 'Mis mazos', onPress: goToDecks, testID: 'back-to-decks' }}
          title="Mazo no encontrado"
        />
        <Message title="Ese mazo ya no existe" variant="error">
          Vuelve a Mis mazos y elige uno de la lista.
        </Message>
      </View>
    );
  }

  const cards = cardsOfDeck(library, deckId);

  const onAddCard = () => {
    const result = addCard(deckId, front, back);
    if (!result.ok) {
      const field =
        result.error === 'frente-requerido'
          ? 'front'
          : result.error === 'reverso-requerido'
            ? 'back'
            : 'form';
      setError({ field, message: libraryErrorMessage(result.error) });
      return;
    }
    setFront('');
    setBack('');
    setError(null);
  };

  const clearError = () => {
    if (error) {
      setError(null);
    }
  };

  return (
    <View style={styles.container}>
      <ScreenHeader
        action={
          <Button
            disabled={cards.length === 0}
            label="Estudiar"
            onPress={() => router.push(`/mazo/${deckId}/estudiar`)}
            testID="study-button"
          />
        }
        back={{ label: 'Mis mazos', onPress: goToDecks, testID: 'back-to-decks' }}
        subtitle={cards.length === 1 ? '1 carta' : `${cards.length} cartas`}
        title={deck.name}
      />

      {cards.length === 0 ? (
        <Message variant="info">
          Añade al menos una carta para poder estudiar este mazo.
        </Message>
      ) : null}

      <Card title="Añadir una carta">
        <Input
          error={error?.field === 'front' ? error.message : undefined}
          label="Frente"
          onChangeText={(value) => {
            setFront(value);
            clearError();
          }}
          placeholder="La pregunta o el término"
          testID="card-front-input"
          value={front}
        />
        <Input
          error={error?.field === 'back' ? error.message : undefined}
          label="Reverso"
          onChangeText={(value) => {
            setBack(value);
            clearError();
          }}
          placeholder="La respuesta"
          testID="card-back-input"
          value={back}
        />
        {error?.field === 'form' ? (
          <Message testID="card-form-error" variant="error">
            {error.message}
          </Message>
        ) : null}
        <Button label="Añadir carta" onPress={onAddCard} testID="add-card-button" />
      </Card>

      {cards.length === 0 ? (
        <EmptyState
          description="Las cartas que crees aparecerán aquí, dentro de este mazo."
          testID="cards-empty"
          title="Este mazo todavía no tiene cartas"
        />
      ) : (
        <View style={styles.list} testID="cards-list">
          {cards.map((card) => (
            <Card key={card.id} testID={`card-${card.id}`}>
              <FlashcardFace label="Frente" text={card.front} />
              <FlashcardFace label="Reverso" text={card.back} tone="back" />
            </Card>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xl,
    width: '100%',
  },
  list: {
    gap: spacing.sm,
    width: '100%',
  },
});
