import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ScreenHeader } from '../src/components/layout';
import { Button, Card, EmptyState, Input, Loading, Message, Select } from '../src/components/ui';
import { libraryErrorMessage } from '../src/features/decks/library';
import {
  buildDeckSummaries,
  deckSortOptions,
  defaultDeckSortOrder,
  formatUpdatedAt,
  type DeckSortOrder,
} from '../src/features/decks/libraryView';
import { useLibrary } from '../src/lib/LibraryProvider';
import { spacing } from '../src/theme';

/** Mis mazos: biblioteca con búsqueda y orden, y creación de mazos nuevos. */
export default function MisMazosScreen() {
  const router = useRouter();
  const { library, status, storageError, createDeck } = useLibrary();

  const [name, setName] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);
  const [query, setQuery] = useState('');
  const [order, setOrder] = useState<DeckSortOrder>(defaultDeckSortOrder);

  const total = library.decks.length;
  const hydrating = status === 'loading';

  const summaries = useMemo(
    () => buildDeckSummaries(library, query, order),
    [library, order, query],
  );

  const onCreate = () => {
    const result = createDeck(name);
    if (!result.ok) {
      setError(libraryErrorMessage(result.error));
      return;
    }
    setName('');
    setError(undefined);
    // Un mazo recién creado que no encaja con la búsqueda activa desaparecería de la lista y
    // parecería que no se ha creado. Se limpia la búsqueda para que se vea.
    setQuery('');
  };

  const onChangeName = (value: string) => {
    setName(value);
    if (error) {
      setError(undefined);
    }
  };

  // Mientras se hidrata no se muestra el estado vacío: sería un vacío falso.
  if (hydrating) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Mis mazos" />
        <Loading message="Recuperando tus mazos…" testID="decks-loading" />
      </View>
    );
  }

  const searching = query.trim().length > 0;

  return (
    <View style={styles.container}>
      <ScreenHeader
        subtitle={total === 1 ? '1 mazo' : `${total} mazos`}
        title="Mis mazos"
      />

      {storageError ? (
        <Message testID="storage-error" title="Problema con el almacenamiento" variant="error">
          {storageError}
        </Message>
      ) : null}

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
        <>
          <Card title="Buscar y ordenar">
            <Input
              label="Buscar mazos"
              onChangeText={setQuery}
              placeholder="Escribe parte del nombre"
              testID="deck-search-input"
              value={query}
            />
            {searching ? (
              <Button
                label="Limpiar búsqueda"
                onPress={() => setQuery('')}
                testID="deck-search-clear"
                variant="secondary"
              />
            ) : null}
            <Select
              label="Ordenar por"
              onChange={setOrder}
              options={deckSortOptions}
              testID="deck-sort"
              value={order}
            />
          </Card>

          {summaries.length === 0 ? (
            <EmptyState
              action={
                <Button
                  label="Limpiar búsqueda"
                  onPress={() => setQuery('')}
                  testID="decks-search-empty-clear"
                  variant="secondary"
                />
              }
              description={`Ningún mazo coincide con "${query.trim()}".`}
              testID="decks-search-empty"
              title="Sin coincidencias"
            />
          ) : (
            <View style={styles.list} testID="decks-list">
              {summaries.map(({ deck, cardCount }) => {
                const cards = cardCount === 1 ? '1 carta' : `${cardCount} cartas`;
                const updated = formatUpdatedAt(deck.updatedAt);
                return (
                  <Card
                    accessibilityLabel={`Abrir el mazo ${deck.name}`}
                    description={updated ? `${cards} · Modificado el ${updated}` : cards}
                    key={deck.id}
                    onPress={() => router.push(`/mazo/${deck.id}`)}
                    testID={`deck-${deck.id}`}
                    title={deck.name}
                  />
                );
              })}
            </View>
          )}
        </>
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
