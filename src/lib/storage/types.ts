import type { Library } from '../../types/domain';

/**
 * Contrato de almacenamiento de la biblioteca.
 *
 * Las pantallas nunca hablan con una tecnología concreta: hablan con el proveedor, y el
 * proveedor habla con este contrato. Sustituir AsyncStorage por otra cosa (o por un backend
 * remoto, cuando esa decisión exista) solo obliga a escribir otra implementación de aquí.
 */
export type LibraryRepository = {
  /** Devuelve lo almacenado. Nunca lanza: los problemas se comunican en el resultado. */
  load: () => Promise<LoadResult>;
  /** Guarda la biblioteca completa. Puede rechazar la promesa si el medio falla. */
  save: (library: Library) => Promise<void>;
};

export type LoadResult =
  | { status: 'ok'; library: Library }
  /** No había nada guardado todavía: primer arranque. */
  | { status: 'empty' }
  /** Había algo, pero no se pudo leer o no tiene la forma esperada. No se sobrescribe. */
  | { status: 'error'; reason: StorageErrorReason };

export type StorageErrorReason = 'ilegible' | 'contenido-invalido';

export function storageErrorMessage(reason: StorageErrorReason): string {
  return reason === 'ilegible'
    ? 'No se han podido leer tus datos guardados. Para no sobrescribirlos, en esta sesión no se guardará nada nuevo.'
    : 'Tus datos guardados no tienen un formato reconocible. Se han dejado intactos y se empieza con la biblioteca vacía.';
}
