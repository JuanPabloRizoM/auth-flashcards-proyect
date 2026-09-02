/**
 * Claves del almacenamiento local.
 *
 * Desde TASK-008 la aplicación tiene cuentas, y los datos de producto de una cuenta no pueden
 * ser visibles para otra en el mismo dispositivo. La forma de conseguirlo es el espacio de
 * nombres: cada usuario autenticado escribe bajo claves que llevan su identificador.
 *
 * ```text
 * flashcards:user:<USER_ID>:library:v1
 * flashcards:user:<USER_ID>:history:v1:meta
 * flashcards:user:<USER_ID>:history:v1:month:2026-09
 * ```
 *
 * El identificador es **`user.id`**, nunca el correo: el correo puede cambiar, y con él
 * cambiaría el espacio de nombres y la persona perdería de vista sus propios datos
 * (docs/PRODUCT.md, 2026-09-02).
 *
 * El sufijo `v1` de cada clave es el que traía la clave original. La versión del documento
 * vive dentro del documento, que es donde puede migrarse; estas claves solo delimitan a quién
 * pertenece lo que hay dentro.
 */

/** Clave de la biblioteca anterior a que existieran cuentas. Solo se lee, para migrar. */
export const LEGACY_LIBRARY_KEY = 'flashcards:library:v1';

/** Prefijo del historial anterior a que existieran cuentas. Solo se lee, para migrar. */
export const LEGACY_HISTORY_PREFIX = 'flashcards:history:v1';

/**
 * Marca de que la migración de los datos previos a las cuentas ya se hizo.
 *
 * Es global a propósito, no por usuario: su trabajo es garantizar que el contenido creado
 * cuando no había cuentas se entrega **una sola vez**, y que ninguna segunda cuenta pueda
 * reclamarlo después.
 */
export const LEGACY_MIGRATION_KEY = 'flashcards:legacy-migration:v1';

function assertUserId(userId: string): string {
  if (userId.trim() === '' || userId.includes(':')) {
    // Un identificador vacío colapsaría los espacios de dos cuentas en el mismo, y uno con
    // dos puntos podría fabricar la clave de otra. Ninguna de las dos cosas puede pasar en
    // silencio.
    throw new Error('El identificador de usuario no es válido para construir claves.');
  }
  return userId;
}

/** Espacio de nombres de un usuario autenticado. */
export function userPrefix(userId: string): string {
  return `flashcards:user:${assertUserId(userId)}`;
}

/** Clave de la biblioteca de un usuario autenticado. */
export function libraryKeyFor(userId: string): string {
  return `${userPrefix(userId)}:library:v1`;
}

/** Prefijo del historial de estudio de un usuario autenticado. */
export function historyPrefixFor(userId: string): string {
  return `${userPrefix(userId)}:history:v1`;
}
