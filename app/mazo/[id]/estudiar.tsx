import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ScreenHeader } from '../../../src/components/layout';
import {
  Button,
  EmptyState,
  FlashcardFace,
  FlashcardSurface,
  Loading,
  Message,
} from '../../../src/components/ui';
import { cardsOfDeck, findDeck } from '../../../src/features/decks/library';
import {
  currentCard,
  goToNextCard,
  isEmpty,
  isFinished,
  progress,
  revealAnswer,
  startSession,
} from '../../../src/features/study/session';
import { useLibrary } from '../../../src/lib/LibraryProvider';
import { goBackOr } from '../../../src/lib/navigation';
import { spacing } from '../../../src/theme';

/**
 * Estudio simple: Frente -> Mostrar respuesta -> Frente + Reverso -> Siguiente carta.
 *
 * Sin calificación y sin repetición espaciada: esas decisiones no están tomadas, así que
 * la pantalla no reserva ni insinúa ningún control para ellas (docs/PRODUCT.md).
 */
export default function EstudiarScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { library, status } = useLibrary();

  const deckId = id ?? '';
  const deck = findDeck(library, deckId);
  const [session, setSession] = useState(() => startSession(cardsOfDeck(library, deckId)));

  // La sesión se construye una vez, cuando los datos ya están hidratados.
  const hydrated = status === 'ready';
  const started = useRef(false);
  useEffect(() => {
    if (hydrated && !started.current) {
      started.current = true;
      setSession(startSession(cardsOfDeck(library, deckId)));
    }
  }, [deckId, hydrated, library]);

  const goToDeck = () => goBackOr(router, () => router.replace(`/mazo/${deckId}`));
  const goToDecks = () => goBackOr(router, () => router.replace('/'));

  if (status === 'loading') {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Estudiar" />
        <Loading message="Recuperando las cartas…" testID="study-loading" />
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

  const backToDeck = { label: deck.name, onPress: goToDeck, testID: 'back-to-deck' };

  if (isEmpty(session)) {
    return (
      <View style={styles.container}>
        <ScreenHeader back={backToDeck} title="Estudiar" />
        <EmptyState
          action={<Button label="Volver al mazo" onPress={goToDeck} testID="back-to-deck-action" />}
          description="Añade cartas al mazo y vuelve para empezar la sesión."
          testID="study-empty"
          title="Este mazo no tiene cartas"
        />
      </View>
    );
  }

  if (isFinished(session)) {
    const { total } = progress(session);
    return (
      <View style={styles.container}>
        <ScreenHeader back={backToDeck} title="Estudiar" />
        <EmptyState
          action={<Button label="Volver al mazo" onPress={goToDeck} testID="finish-back-button" />}
          description={
            total === 1
              ? 'Has repasado la única carta de este mazo.'
              : `Has repasado las ${total} cartas de este mazo.`
          }
          testID="study-finished"
          title="Sesión terminada"
        />
      </View>
    );
  }

  const card = currentCard(session);
  const { position, total } = progress(session);

  return (
    <View style={styles.container}>
      <ScreenHeader
        back={backToDeck}
        subtitle={`Carta ${position} de ${total}`}
        title="Estudiar"
      />

      <FlashcardSurface testID="study-card">
        <FlashcardFace label="Frente" size="prompt" testID="study-front" text={card?.front ?? ''} />
        {session.revealed && card ? (
          <FlashcardFace
            label="Reverso"
            size="prompt"
            testID="study-back"
            text={card.back}
            tone="back"
          />
        ) : null}
      </FlashcardSurface>

      {session.revealed ? (
        <Button
          label="Siguiente carta"
          onPress={() => setSession(goToNextCard(session))}
          testID="next-card-button"
        />
      ) : (
        <Button
          label="Mostrar respuesta"
          onPress={() => setSession(revealAnswer(session))}
          testID="reveal-button"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xl,
    width: '100%',
  },
});
