import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ScreenHeader } from '../src/components/layout';
import { Button, Card, EmptyState, Input } from '../src/components/ui';
import { countCardsOfDeck, libraryErrorMessage } from '../src/features/decks/library';
import { useLibrary } from '../src/lib/LibraryProvider';
import { spacing } from '../src/theme';

/** Mis mazos: lista los mazos y permite crear uno nuevo. */
export default function MisMazosScreen() {
  const router = useRouter();
  const { library, createDeck } = useLibrary();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);

  const total = library.decks.length;

  const onCreate = () => {
    const result = createDeck(name);
    if (!result.ok) {
      setError(libraryErrorMessage(result.error));
      return;
    }
    setName('');
    setError(undefined);
  };

  const onChangeName = (value: string) => {
    setName(value);
    if (error) {
      setError(undefined);
    }
  };

  return (
    <View style={styles.container}>
      <ScreenHeader
        subtitle={total === 1 ? '1 mazo' : `${total} mazos`}
        title="Mis mazos"
      />

      <Card title="Crear un mazo">
        <Input
          error={error}
          helperText="Por ejemplo: Inglés, Anatomía, Vocabulario técnico."
          label="Nombre del mazo"
          onChangeText={onChangeName}
          placeholder="Nombre del mazo"
          testID="deck-name-input"
          value={name}
        />
        <Button label="Crear mazo" onPress={onCreate} testID="create-deck-button" />
      </Card>

      {total === 0 ? (
        <EmptyState
          description="Crea tu primer mazo arriba y empieza a añadirle cartas."
          testID="decks-empty"
          title="Todavía no tienes mazos"
        />
      ) : (
        <View style={styles.list} testID="decks-list">
          {library.decks.map((deck) => {
            const cards = countCardsOfDeck(library, deck.id);
            return (
              <Card
                accessibilityLabel={`Abrir el mazo ${deck.name}`}
                description={cards === 1 ? '1 carta' : `${cards} cartas`}
                key={deck.id}
                onPress={() => router.push(`/mazo/${deck.id}`)}
                testID={`deck-${deck.id}`}
                title={deck.name}
              />
            );
          })}
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
