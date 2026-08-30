import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ScreenHeader } from '../../../src/components/layout';
import { RatingButtons } from '../../../src/components/study';
import {
  Button,
  EmptyState,
  FlashcardFace,
  FlashcardSurface,
  Loading,
  Message,
} from '../../../src/components/ui';
import { cardsOfDeck, findDeck } from '../../../src/features/decks/library';
import { appScheduler } from '../../../src/features/scheduler';
import type { ReviewRating, SpacedRepetitionScheduler } from '../../../src/features/scheduler/types';
import { commitReview, reviewCommitMessage } from '../../../src/features/study/review';
import {
  applyRating,
  currentCard,
  isEmpty,
  isFinished,
  progress,
  revealAnswer,
  startSession,
  type StudySession,
} from '../../../src/features/study/session';
import { systemClock, type Clock } from '../../../src/lib/clock';
import { useLibrary } from '../../../src/lib/LibraryProvider';
import { useStudyHistory } from '../../../src/lib/StudyHistoryProvider';
import { goBackOr } from '../../../src/lib/navigation';
import { spacing } from '../../../src/theme';

/**
 * Estudio con repetición espaciada.
 *
 * Frente -> Mostrar respuesta -> Frente + Reverso -> Otra vez / Difícil / Bien / Fácil ->
 * el scheduler programa la próxima aparición -> siguiente tarjeta elegible
 * (docs/PRODUCT.md, 2026-08-30).
 *
 * La pantalla no calcula intervalos ni decide el orden: pide la cola a
 * `features/study` y los intervalos al scheduler. Aquí solo se orquesta qué se enseña y
 * cuándo se guarda.
 */
export type EstudiarScreenProps = {
  /**
   * Reloj inyectable.
   *
   * En producción es el del dispositivo. Un test puede fijar un instante, calificar,
   * adelantar el reloj y comprobar que una tarjeta programada para dentro de dos días pasa
   * a estar disponible, que es la única forma de probar de verdad la programación.
   */
  clock?: Clock;
  /** Scheduler inyectable. La aplicación usa siempre el mismo. */
  scheduler?: SpacedRepetitionScheduler;
};

export default function EstudiarScreen({
  clock = systemClock,
  scheduler = appScheduler,
}: EstudiarScreenProps = {}) {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { library, status, saveCardScheduling } = useLibrary();
  const { study } = useStudyHistory();

  const deckId = id ?? '';
  const deck = findDeck(library, deckId);

  const [session, setSession] = useState<StudySession>(() => startSession([], clock.now()));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  /**
   * Cerrojo síncrono de la calificación.
   *
   * Un estado de React no sirve para esto: dos pulsaciones en el mismo tick verían las dos
   * `saving` en `false` y producirían dos escrituras y dos registros de revisión. Una
   * referencia se actualiza en el acto (docs/PRODUCT.md: una respuesta, una escritura).
   */
  const inFlight = useRef(false);
  /**
   * La última aparición ya calificada.
   *
   * El cerrojo se suelta al terminar de guardar, pero React todavía no ha repintado con la
   * carta siguiente. Una pulsación que cayera justo en ese hueco ejecutaría el closure viejo
   * y volvería a calificar la misma carta. Recordar qué aparición se ha calificado —la carta
   * y su turno dentro de la sesión— lo cierra del todo.
   */
  const lastRated = useRef<string | null>(null);

  // La sesión se construye una sola vez, cuando los datos ya están hidratados. Reconstruirla
  // en cada cambio de la biblioteca la reiniciaría con cada calificación.
  const hydrated = status === 'ready';
  const started = useRef(false);
  useEffect(() => {
    if (!hydrated || started.current) return;
    started.current = true;

    const opened = startSession(cardsOfDeck(library, deckId), clock.now());
    setSession(opened);
    // Un mazo sin cartas elegibles no abre sesión: no habría nada que registrar.
    const first = currentCard(opened);
    if (first) {
      study.begin(deckId);
      study.show(first.id);
    }
  }, [clock, deckId, hydrated, library, study]);

  /**
   * Cerrar la sesión al salir de la pantalla.
   *
   * Se hace en la limpieza del efecto además de en el botón: se sale de estudiar de muchas
   * maneras (volver, navegar a otro destino, cerrar la pestaña) y la sesión tiene que
   * quedar cerrada en todas. `end` descarta la carta que quedara a la vista sin calificar y
   * solo guarda la sesión si llegó a completarse alguna.
   */
  useEffect(() => () => study.end(), [study]);

  const card = currentCard(session);

  /**
   * Los cuatro intervalos que se enseñan.
   *
   * Salen del preview real del scheduler, que no modifica la carta. Se recalculan cuando
   * cambia la carta a la vista o cuando se revela la respuesta; no en cada renderizado,
   * porque entonces el intervalo bailaría solo mientras se lee la tarjeta.
   */
  const preview = useMemo(
    () => (card ? scheduler.preview(card.scheduling, clock.now()) : null),
    // `session.answered` identifica la aparición concreta: la misma carta puede volver a
    // salir en esta sesión, y entonces su preview ya no es el mismo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [card?.id, session.answered, session.revealed, scheduler, clock],
  );

  const onReveal = () => {
    study.reveal();
    setSession(revealAnswer(session));
  };

  const onRate = useCallback(
    async (rating: ReviewRating) => {
      if (inFlight.current || !card) return;
      const appearance = `${card.id}|${session.answered}`;
      if (lastRated.current === appearance) return;
      inFlight.current = true;
      setSaving(true);

      try {
        const outcome = scheduler.rate(card.scheduling, rating, clock.now());
        const result = await commitReview(
          {
            saveScheduling: saveCardScheduling,
            recordReview: () => study.review({ previous: card.scheduling, outcome }),
          },
          { cardId: card.id, previous: card.scheduling, outcome },
        );

        if (result.status !== 'ok') {
          // No se avanza: la carta sigue a la vista y se explica qué pasó.
          setError(reviewCommitMessage(result.status));
          return;
        }

        setError(undefined);
        lastRated.current = appearance;
        const next = applyRating(session, outcome);
        setSession(next);
        const upcoming = currentCard(next);
        if (upcoming) {
          study.show(upcoming.id);
        } else {
          study.end();
        }
      } finally {
        inFlight.current = false;
        setSaving(false);
      }
    },
    [card, clock, saveCardScheduling, scheduler, session, study],
  );

  const goToDeck = () => goBackOr(router, () => router.replace(`/mazo/${deckId}`));
  const goToDecks = () => goBackOr(router, () => router.replace('/'));

  const onFinish = () => {
    study.end();
    goToDeck();
  };

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
    const deckIsEmpty = cardsOfDeck(library, deckId).length === 0;
    return (
      <View style={styles.container}>
        <ScreenHeader back={backToDeck} title="Estudiar" />
        <EmptyState
          action={<Button label="Volver al mazo" onPress={goToDeck} testID="back-to-deck-action" />}
          description={
            deckIsEmpty
              ? 'Añade cartas al mazo y vuelve para empezar la sesión.'
              : 'Ninguna tarjeta de este mazo toca ahora mismo. Vuelve cuando venza la siguiente.'
          }
          testID="study-empty"
          title={deckIsEmpty ? 'Este mazo no tiene cartas' : 'Nada que estudiar por ahora'}
        />
      </View>
    );
  }

  const { answered, remaining, studied } = progress(session);

  if (isFinished(session)) {
    return (
      <View style={styles.container}>
        <ScreenHeader back={backToDeck} title="Estudiar" />
        <EmptyState
          action={<Button label="Volver al mazo" onPress={goToDeck} testID="finish-back-button" />}
          description={
            studied === 1
              ? 'Has terminado con la única tarjeta que tocaba.'
              : `Has terminado con las ${studied} tarjetas que tocaban.`
          }
          testID="study-finished"
          title="Sesión terminada"
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader
        back={backToDeck}
        subtitle={
          answered === 0
            ? `${remaining === 1 ? '1 tarjeta' : `${remaining} tarjetas`} por delante`
            : `${answered === 1 ? '1 respuesta' : `${answered} respuestas`} · ${remaining === 1 ? '1 pendiente' : `${remaining} pendientes`}`
        }
        title="Estudiar"
      />

      {error ? (
        <Message testID="study-error" title="No se ha podido guardar" variant="error">
          {error}
        </Message>
      ) : null}

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

      {session.revealed && preview ? (
        <RatingButtons
          disabled={saving}
          onRate={(rating) => void onRate(rating)}
          preview={preview}
          testID="rating-buttons"
        />
      ) : (
        <Button label="Mostrar respuesta" onPress={onReveal} testID="reveal-button" />
      )}

      <Button
        label="Terminar sesión"
        onPress={onFinish}
        testID="finish-session-button"
        variant="secondary"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xl,
    width: '100%',
  },
});
