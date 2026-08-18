/** Tipos del dominio. Sin dependencias de interfaz ni de almacenamiento. */

export type Deck = {
  id: string;
  name: string;
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
