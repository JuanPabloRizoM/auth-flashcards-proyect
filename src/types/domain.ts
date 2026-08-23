/** Tipos del dominio. Sin dependencias de interfaz ni de almacenamiento. */

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
};

/** Estado completo de la biblioteca: los mazos y todas sus cartas. */
export type Library = {
  decks: Deck[];
  cards: Card[];
};
