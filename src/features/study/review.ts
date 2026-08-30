import type { CardScheduling, SchedulingOutcome } from '../scheduler/types';

/**
 * Confirmación de una calificación sobre dos almacenes locales.
 *
 * Calificar toca dos sitios que no comparten transacción: la biblioteca, donde vive la
 * programación de la carta, y el historial, donde vive el registro de la revisión y el
 * evento estadístico. Van separados a propósito desde TASK-006 —la biblioteca se reescribe
 * entera y de ella se borran cosas, el historial solo crece— y el almacenamiento local no
 * ofrece una escritura atómica que abarque a los dos.
 *
 * ## Estrategia
 *
 * 1. Se escribe **primero la biblioteca**, con la programación nueva.
 * 2. Si eso falla, no se escribe nada más y no se avanza de carta. El estado guardado sigue
 *    siendo exactamente el de antes.
 * 3. Si sale bien, se escribe el historial y se espera a que llegue al medio.
 * 4. Si el historial falla, se **revierte la biblioteca** al valor anterior, que quien llama
 *    todavía tiene en memoria. Es una compensación explícita, no un olvido.
 * 5. Si la compensación también falla, se dice: el estado ha quedado adelantado respecto al
 *    registro y la sesión no debe continuar como si nada.
 *
 * En ninguna rama se avanza a la carta siguiente: quien llama solo avanza con `ok`.
 *
 * ## Límite conocido
 *
 * No es atomicidad real. Un corte de corriente entre el paso 1 y el paso 3 deja la
 * programación aplicada sin su registro de revisión. La consecuencia es acotada y no es
 * corrupción: la carta queda programada y esa calificación no aparece en las estadísticas
 * de calificación. Se prefiere a la alternativa —registrar primero y arriesgarse a contar
 * una calificación que nunca se aplicó—, porque lo que la persona usuaria ve al volver es
 * la programación, y el registro es una bitácora que ya declara que solo cubre lo que llegó
 * a escribirse. Queda documentado también en docs/DATABASE.md.
 */

export type ReviewCommitStatus =
  | 'ok'
  /** No se pudo guardar la programación. No se ha escrito nada. */
  | 'scheduling-failed'
  /** No se pudo registrar la revisión; la programación se ha revertido. */
  | 'log-failed'
  /** No se pudo registrar la revisión y tampoco revertir la programación. */
  | 'inconsistent';

export type ReviewCommitResult = { status: ReviewCommitStatus };

export type ReviewCommitDeps = {
  /** Guarda la programación de una carta. `false` si el medio falló. */
  saveScheduling: (cardId: string, scheduling: CardScheduling) => Promise<boolean>;
  /** Registra la revisión y el evento estadístico. `false` si el medio falló. */
  recordReview: () => Promise<boolean>;
};

export type ReviewCommitInput = {
  cardId: string;
  /** Programación anterior, para poder revertir. */
  previous: CardScheduling;
  outcome: SchedulingOutcome;
};

export async function commitReview(
  deps: ReviewCommitDeps,
  { cardId, previous, outcome }: ReviewCommitInput,
): Promise<ReviewCommitResult> {
  const saved = await deps.saveScheduling(cardId, outcome.scheduling);
  if (!saved) {
    return { status: 'scheduling-failed' };
  }

  const recorded = await deps.recordReview();
  if (recorded) {
    return { status: 'ok' };
  }

  const reverted = await deps.saveScheduling(cardId, previous);
  return { status: reverted ? 'log-failed' : 'inconsistent' };
}

/** Qué se le dice a la persona usuaria en cada caso. Siempre se queda en la misma carta. */
export function reviewCommitMessage(status: ReviewCommitStatus): string | undefined {
  switch (status) {
    case 'ok':
      return undefined;
    case 'scheduling-failed':
      return 'No se ha podido guardar tu respuesta en este dispositivo. La tarjeta sigue como estaba; inténtalo otra vez.';
    case 'log-failed':
      return 'No se ha podido registrar tu respuesta en el historial. Se ha deshecho el cambio para no descuadrar tus estadísticas; inténtalo otra vez.';
    case 'inconsistent':
      return 'No se ha podido guardar tu respuesta ni deshacer el cambio. Termina la sesión y vuelve a entrar antes de seguir estudiando.';
  }
}
