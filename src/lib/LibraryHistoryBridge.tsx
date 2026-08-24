import { useEffect } from 'react';

import { useLibrary } from './LibraryProvider';
import { useStudyHistory } from './StudyHistoryProvider';

/**
 * Puente entre la biblioteca y el historial.
 *
 * Lo único que el historial necesita saber de la biblioteca es el último nombre conocido
 * de cada mazo, para poder nombrarlo en una vista histórica si más adelante se elimina.
 * Se mantiene aquí, en un componente sin interfaz, y no dentro de `LibraryProvider`: la
 * biblioteca no debe depender del historial, porque eliminar un mazo tiene que poder
 * vaciar la biblioteca sin rozar un solo evento.
 *
 * Renombrar un mazo actualiza el snapshot y no crea un historial nuevo: la identidad
 * siempre es el `id` (docs/PRODUCT.md, 2026-08-23).
 */
export function LibraryHistoryBridge() {
  const { library, status } = useLibrary();
  const { rememberDecks, status: historyStatus } = useStudyHistory();

  useEffect(() => {
    if (status !== 'ready' || historyStatus !== 'ready') return;
    rememberDecks(library.decks);
  }, [historyStatus, library.decks, rememberDecks, status]);

  return null;
}
