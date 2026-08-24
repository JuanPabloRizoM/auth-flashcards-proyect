import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { DeckCardRow, DeckRenameForm } from '../../../src/components/decks';
import { ScreenHeader } from '../../../src/components/layout';
import {
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Input,
  Loading,
  Message,
} from '../../../src/components/ui';
import { cardsOfDeck, findDeck, libraryErrorMessage } from '../../../src/features/decks/library';
import { useLibrary } from '../../../src/lib/LibraryProvider';
import { useStudyHistory } from '../../../src/lib/StudyHistoryProvider';
import { goBackOr } from '../../../src/lib/navigation';
import { spacing } from '../../../src/theme';

/** Detalle de un mazo: renombrarlo, eliminarlo, y crear, editar y borrar sus cartas. */
export default function DetalleMazoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { library, status, addCard, renameDeck, deleteDeck, editCard, deleteCard } = useLibrary();
  const { recordCardsAdded } = useStudyHistory();

  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  /** El error se ancla al campo que lo provoca, no a un campo cualquiera del formulario. */
  const [error, setError] = useState<{ field: 'front' | 'back' | 'form'; message: string } | null>(
    null,
  );
  const [renaming, setRenaming] = useState(false);
  /** Qué borrado está esperando confirmación: el mazo entero o una carta concreta. */
  const [pendingDelete, setPendingDelete] = useState<
    { kind: 'deck' } | { kind: 'card'; cardId: string } | null
  >(null);

  const deckId = id ?? '';
  const deck = findDeck(library, deckId);
  const goToDecks = () => goBackOr(router, () => router.replace('/'));

  // Sin esperar a la hidratación, un mazo persistido se declararía inexistente.
  if (status === 'loading') {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Mazo" />
        <Loading message="Recuperando el mazo…" testID="deck-loading" />
      </View>
    );
  }

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
    // El alta queda registrada con su origen para las estadísticas. La biblioteca no sabe
    // nada del historial: es esta pantalla la que sabe de dónde salió la carta.
    recordCardsAdded(deckId, [result.cardId], 'manual');
    setFront('');
    setBack('');
    setError(null);
  };

  const clearError = () => {
    if (error) {
      setError(null);
    }
  };

  const onRename = (name: string): string | undefined => {
    const result = renameDeck(deckId, name);
    if (!result.ok) {
      return libraryErrorMessage(result.error);
    }
    setRenaming(false);
    return undefined;
  };

  const onEditCard = (cardId: string, nextFront: string, nextBack: string): string | undefined => {
    const result = editCard(cardId, nextFront, nextBack);
    return result.ok ? undefined : libraryErrorMessage(result.error);
  };

  const confirmDelete = () => {
    if (pendingDelete === null) {
      return;
    }
    if (pendingDelete.kind === 'deck') {
      // El mazo deja de existir: quedarse en su pantalla mostraría "mazo no encontrado".
      deleteDeck(deckId);
      setPendingDelete(null);
      goToDecks();
      return;
    }
    deleteCard(pendingDelete.cardId);
    setPendingDelete(null);
  };

  const deletingDeck = pendingDelete?.kind === 'deck';
  const cardCount = cards.length;

  return (
    <View style={styles.container}>
      <ScreenHeader
        action={
          <Button
            disabled={cardCount === 0}
            label="Estudiar"
            onPress={() => router.push(`/mazo/${deckId}/estudiar`)}
            testID="study-button"
          />
        }
        back={{ label: 'Mis mazos', onPress: goToDecks, testID: 'back-to-decks' }}
        subtitle={cardCount === 1 ? '1 carta' : `${cardCount} cartas`}
        title={deck.name}
      />

      <View style={styles.actions}>
        <Button
          label="Renombrar"
          onPress={() => setRenaming(true)}
          testID="rename-deck-button"
          variant="secondary"
        />
        <Button
          label="Importar tarjetas"
          onPress={() => router.push(`/mazo/${deckId}/importar`)}
          testID="import-button"
          variant="secondary"
        />
        <Button
          label="Eliminar mazo"
          onPress={() => setPendingDelete({ kind: 'deck' })}
          testID="delete-deck-button"
          variant="danger"
        />
      </View>

      {renaming ? (
        <DeckRenameForm
          currentName={deck.name}
          onCancel={() => setRenaming(false)}
          onSave={onRename}
        />
      ) : null}

      {cardCount === 0 ? (
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

      {cardCount === 0 ? (
        <EmptyState
          description="Las cartas que crees aparecerán aquí, dentro de este mazo."
          testID="cards-empty"
          title="Este mazo todavía no tiene cartas"
        />
      ) : (
        <View style={styles.list} testID="cards-list">
          {cards.map((card) => (
            <DeckCardRow
              card={card}
              key={card.id}
              onRequestDelete={() => setPendingDelete({ kind: 'card', cardId: card.id })}
              onSave={(nextFront, nextBack) => onEditCard(card.id, nextFront, nextBack)}
            />
          ))}
        </View>
      )}

      <ConfirmDialog
        confirmLabel={
          deletingDeck ? (cardCount === 0 ? 'Eliminar mazo' : 'Eliminar mazo y cartas') : 'Eliminar carta'
        }
        description={
          deletingDeck
            ? deleteDeckDescription(deck.name, cardCount)
            : 'Se eliminará esta carta. El mazo y las demás cartas no se tocan. Esta acción no se puede deshacer.'
        }
        onCancel={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        testID="delete-confirm"
        title={deletingDeck ? '¿Eliminar el mazo?' : '¿Eliminar la carta?'}
        visible={pendingDelete !== null}
      />
    </View>
  );
}

/**
 * Qué se va a borrar exactamente.
 *
 * Un mazo vacío no tiene cartas que mencionar: decir "y también las 0 cartas que contiene"
 * es a la vez raro de leer y una advertencia sobre algo que no existe.
 */
function deleteDeckDescription(name: string, cardCount: number): string {
  const irreversible = 'Esta acción no se puede deshacer.';

  if (cardCount === 0) {
    return `Se eliminará el mazo "${name}", que no tiene ninguna carta. ${irreversible}`;
  }

  const cards =
    cardCount === 1 ? 'la carta que contiene' : `las ${cardCount} cartas que contiene`;
  return `Se eliminará el mazo "${name}" y también ${cards}. ${irreversible}`;
}

const styles = StyleSheet.create({
  actions: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  container: {
    gap: spacing.xl,
    width: '100%',
  },
  list: {
    gap: spacing.sm,
    width: '100%',
  },
});
