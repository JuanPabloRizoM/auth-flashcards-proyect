import type { Library } from '../../types/domain';

import { parseStoredLibrary, serializeLibrary } from './serialization';
import type { LibraryRepository, LoadResult } from './types';

/**
 * Implementación del mismo contrato sobre una cadena en memoria.
 *
 * Sirve para las pruebas: recorre exactamente el mismo camino de serialización que la
 * implementación persistente, así que un test puede desmontar el proveedor, montar otro con
 * el mismo repositorio y comprobar que los datos se recuperan de verdad del almacenamiento
 * y no de un estado de React que sobrevivió.
 */
export function createMemoryRepository(initialRaw: string | null = null): LibraryRepository & {
  /** Lo que hay guardado ahora mismo, tal cual. Para poder afirmar sobre el medio. */
  peek: () => string | null;
} {
  let raw: string | null = initialRaw;

  return {
    peek: () => raw,
    async load(): Promise<LoadResult> {
      return parseStoredLibrary(raw);
    },
    async save(library: Library): Promise<void> {
      raw = serializeLibrary(library);
    },
  };
}

/** Repositorio que falla siempre, para comprobar que la aplicación no se rompe. */
export function createFailingRepository(
  reason: 'ilegible' | 'contenido-invalido' = 'ilegible',
): LibraryRepository {
  return {
    async load(): Promise<LoadResult> {
      return { status: 'error', reason };
    },
    async save(): Promise<void> {
      throw new Error('almacenamiento no disponible');
    },
  };
}

/**
 * Repositorio que lee correctamente pero falla al guardar.
 *
 * Necesario para ejercitar el manejo de errores de escritura: un repositorio que además
 * falle al leer suspende las escrituras, así que `save` no llegaría a invocarse y el test
 * quedaría inerte.
 */
export function createWriteFailingRepository(): LibraryRepository {
  return {
    async load(): Promise<LoadResult> {
      return { status: 'empty' };
    },
    async save(): Promise<void> {
      throw new Error('no se pudo escribir en el medio');
    },
  };
}
