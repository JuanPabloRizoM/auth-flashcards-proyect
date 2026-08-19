import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Library } from '../../types/domain';

import { parseStoredLibrary, serializeLibrary } from './serialization';
import type { LibraryRepository, LoadResult } from './types';

/**
 * Implementación persistente del contrato, sobre AsyncStorage.
 *
 * Es el único archivo del proyecto que conoce la librería de almacenamiento. Funciona en las
 * tres plataformas declaradas: en web se apoya en localStorage y en iOS y Android en el
 * almacenamiento nativo, con la misma API, así que no hacen falta adaptadores distintos.
 */
export const STORAGE_KEY = 'flashcards:library:v1';

export function createAsyncStorageRepository(
  storage: Pick<typeof AsyncStorage, 'getItem' | 'setItem'> = AsyncStorage,
): LibraryRepository {
  return {
    async load(): Promise<LoadResult> {
      try {
        const raw = await storage.getItem(STORAGE_KEY);
        return parseStoredLibrary(raw);
      } catch {
        // El medio falló al leer. No se toca lo que hubiera guardado.
        return { status: 'error', reason: 'ilegible' };
      }
    },

    async save(library: Library): Promise<void> {
      await storage.setItem(STORAGE_KEY, serializeLibrary(library));
    },
  };
}
