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
/**
 * @param key Clave completa bajo la que vive la biblioteca. Desde TASK-008 la determina el
 * usuario autenticado (`libraryKeyFor`): dos cuentas del mismo dispositivo no comparten
 * documento. Es obligatoria a propósito, para que ningún punto de creación olvidado escriba
 * en el espacio anterior a las cuentas.
 *
 * La clave conserva el sufijo `v1` con el que nació en TASK-004 aunque el documento vaya ya
 * por la versión 3. La versión vive dentro del documento, que es donde puede migrarse.
 */
export function createAsyncStorageRepository(
  key: string,
  storage: Pick<typeof AsyncStorage, 'getItem' | 'setItem'> = AsyncStorage,
): LibraryRepository {
  return {
    async load(): Promise<LoadResult> {
      try {
        const raw = await storage.getItem(key);
        return parseStoredLibrary(raw);
      } catch {
        // El medio falló al leer. No se toca lo que hubiera guardado.
        return { status: 'error', reason: 'ilegible' };
      }
    },

    async save(library: Library): Promise<void> {
      await storage.setItem(key, serializeLibrary(library));
    },
  };
}
