/** Tipos del dominio. Sin dependencias de interfaz ni de almacenamiento. */

import type { CardScheduling, SchedulerParameters } from '../features/scheduler/types';

export type Deck = {
  id: string;
  name: string;
  /**
   * Instante ISO 8601 de la última modificación del mazo.
   *
   * Cuenta como modificación todo lo que cambia lo que el mazo contiene o cómo se llama:
   * crearlo, renombrarlo, y añadir, editar, importar o borrar una de sus cartas. Existe
   * porque Mis mazos ordena por modificación; sin este campo ese orden no es demostrable.
   */
  updatedAt: string;
};

export type Card = {
  id: string;
  deckId: string;
  front: string;
  back: string;
  /**
   * Estado de repetición espaciada de la carta.
   *
   * Vive con la carta y no en un almacén aparte porque su ciclo de vida es exactamente el
   * de la carta: se crea con ella, se borra con ella y se lee siempre que se lee la carta.
   * Una carta recién creada o migrada desde una versión anterior está en estado `nueva`.
   */
  scheduling: CardScheduling;
};

/**
 * Qué scheduler programó esta biblioteca.
 *
 * Se persiste con los datos para que una actualización futura de FSRS pueda saber con qué
 * reglas y con qué parámetros se calcularon los vencimientos que ya están guardados. Sin
 * esto, una migración futura tendría que adivinarlo.
 */
export type SchedulerMetadata = {
  id: string;
  version: string;
  parameters: SchedulerParameters;
};

/** Estado completo de la biblioteca: los mazos y todas sus cartas. */
export type Library = {
  decks: Deck[];
  cards: Card[];
  /** `null` en una biblioteca que todavía no ha pasado por ningún scheduler. */
  scheduler: SchedulerMetadata | null;
};
