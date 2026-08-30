import type { CardScheduling, SchedulingState } from '../scheduler/types';

import type { Card } from '../../types/domain';

/**
 * Construcción de la cola de estudio.
 *
 * Funciones puras sobre las cartas de un mazo y un instante. No leen el reloj, no conocen
 * React y no hablan con el almacenamiento (docs/ARCHITECTURE.md, reglas 1 y 3).
 *
 * ## Estrategia, y por qué esta
 *
 * La cola sale del estado de cada carta y de su vencimiento, nunca de su posición en la
 * lista. El orden es:
 *
 * 1. **Aprendizaje y reaprendizaje ya vencidos.** Son cartas a medio aprender: dejarlas
 *    para el final alargaría el intervalo real que el scheduler acaba de calcular en
 *    minutos, y el aprendizaje se resentiría.
 * 2. **Repasos vencidos.** Cuanto más atrasados, antes: se ordenan por vencimiento
 *    ascendente, así que lo más rezagado se recupera primero.
 * 3. **Cartas nuevas.** Van al final para que un mazo recién importado no entierre los
 *    repasos que ya tocaban.
 *
 * Dentro de cada grupo, el orden es por vencimiento ascendente y, a igualdad, por
 * identificador. Las nuevas conservan el orden en el que se crearon. **No hay ninguna
 * aleatoriedad**: la misma biblioteca y el mismo instante producen siempre la misma cola,
 * que es lo que permite que los tests afirmen sobre ella. El fuzz de FSRS está desactivado
 * por la misma razón (ver `fsrsAdapter.ts`).
 *
 * No hay límite de nuevas por día ni de repasos por día: son decisiones de producto que
 * siguen sin tomarse (docs/PRODUCT.md).
 */

/** En qué grupo de la cola cae una carta. */
export type QueueGroup = 'aprendiendo' | 'repaso' | 'nueva';

const learningStates: readonly SchedulingState[] = ['aprendiendo', 'reaprendiendo'];

function isLearning(scheduling: CardScheduling): boolean {
  return learningStates.includes(scheduling.state);
}

/**
 * ¿Está disponible ahora mismo?
 *
 * Sin vencimiento no hay nada que esperar: la carta está disponible. Es el caso de las
 * nuevas, y también el único razonable para cualquier otro estado que llegara sin fecha.
 * Es exactamente la misma regla que `scheduler.isDue`, escrita aquí para que la cola no
 * dependa de una instancia del scheduler; hay un test que comprueba que no divergen.
 */
export function isAvailable(scheduling: CardScheduling, now: number): boolean {
  return scheduling.due === null || scheduling.due <= now;
}

/** El grupo de la cola al que pertenece una carta disponible. */
export function queueGroupOf(scheduling: CardScheduling): QueueGroup {
  if (scheduling.state === 'nueva') return 'nueva';
  return isLearning(scheduling) ? 'aprendiendo' : 'repaso';
}

const groupOrder: Record<QueueGroup, number> = { aprendiendo: 0, repaso: 1, nueva: 2 };

/**
 * Cartas que corresponde estudiar ahora, en orden.
 *
 * Las cartas que llegan aquí ya están acotadas al mazo por quien llama; una carta de otro
 * mazo no puede entrar porque no está en la lista.
 */
export function buildStudyQueue(cards: readonly Card[], now: number): Card[] {
  const available = cards
    .map((card, position) => ({ card, position }))
    .filter(({ card }) => isAvailable(card.scheduling, now));

  return available
    .sort((a, b) => {
      const groupDelta =
        groupOrder[queueGroupOf(a.card.scheduling)] - groupOrder[queueGroupOf(b.card.scheduling)];
      if (groupDelta !== 0) return groupDelta;
      // Las nuevas no tienen vencimiento: conservan el orden de creación.
      const dueA = a.card.scheduling.due;
      const dueB = b.card.scheduling.due;
      if (dueA !== null && dueB !== null && dueA !== dueB) return dueA - dueB;
      return a.position - b.position;
    })
    .map(({ card }) => card);
}

/**
 * Contadores del resumen del mazo.
 *
 * Describen **lo que la cola contendría ahora mismo**, repartido por grupo. Es la
 * definición que hace que los tres números y la sesión no puedan discrepar: si "Repasar"
 * dice 14, hay catorce cartas de repaso esperando, no catorce cartas de repaso en total.
 * Una carta programada para dentro de dos días no se cuenta como vencida
 * (docs/PRODUCT.md, 2026-08-30).
 *
 * `aprendiendoMasTarde` no forma parte de la cola: son cartas a medio aprender cuyo turno
 * es dentro de unos minutos. Se cuenta aparte para poder decirlo en vez de dejar que
 * desaparezcan sin explicación.
 */
export type DeckStudySummary = {
  nuevas: number;
  aprendiendo: number;
  repasar: number;
  /** Total disponible: la suma de los tres anteriores y el tamaño de la cola. */
  disponibles: number;
  aprendiendoMasTarde: number;
  /** Cartas del mazo, disponibles o no. */
  total: number;
};

export function deckStudySummary(cards: readonly Card[], now: number): DeckStudySummary {
  let nuevas = 0;
  let aprendiendo = 0;
  let repasar = 0;
  let aprendiendoMasTarde = 0;

  for (const { scheduling } of cards) {
    if (scheduling.state === 'nueva') {
      nuevas += 1;
      continue;
    }
    const disponible = isAvailable(scheduling, now);
    if (isLearning(scheduling)) {
      if (disponible) aprendiendo += 1;
      else aprendiendoMasTarde += 1;
      continue;
    }
    if (disponible) repasar += 1;
  }

  return {
    nuevas,
    aprendiendo,
    repasar,
    disponibles: nuevas + aprendiendo + repasar,
    aprendiendoMasTarde,
    total: cards.length,
  };
}
