import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  historyPrefixFor,
  libraryKeyFor,
  LEGACY_HISTORY_PREFIX,
  LEGACY_LIBRARY_KEY,
  LEGACY_MIGRATION_KEY,
} from './keys';

/**
 * Migración de los datos creados antes de que existieran cuentas.
 *
 * Hasta TASK-008 la biblioteca y el historial vivían en claves fijas, sin dueño. Ahora cada
 * usuario tiene su espacio de nombres, así que ese contenido sin dueño hay que entregárselo
 * a alguien exactamente una vez:
 *
 * ```text
 * datos previos a las cuentas
 *            │
 *            ▼
 *   primer usuario que inicia sesión
 *            │
 *            ▼
 *   flashcards:user:<USER_ID>:…
 * ```
 *
 * Cinco reglas, y las cinco son comprobables:
 *
 * 1. **Una sola vez.** Una marca global registra qué `user.id` recibió los datos. Cualquier
 *    cuenta posterior encuentra la marca y no recibe nada.
 * 2. **No destructiva.** Las claves originales no se borran nunca. Copiar cuesta el espacio
 *    de una biblioteca; borrar cuesta perderla si algo sale mal a mitad.
 * 3. **No sobrescribe.** Si el destino ya tiene contenido —porque el usuario ya usó la
 *    aplicación con su cuenta— esa clave se respeta y no se toca.
 * 4. **Verificada antes de marcar.** La marca solo se escribe después de releer del medio
 *    todo lo copiado y comprobar que coincide. Un fallo deja el original intacto, sin marca,
 *    y el intento siguiente vuelve a empezar.
 * 5. **Idempotente.** Repetirla no cambia nada.
 */

/** Lo mínimo que la migración necesita de un almacenamiento de clave/valor. */
export type MigrationStore = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  getAllKeys: () => Promise<readonly string[]>;
};

export type LegacyMigrationResult =
  /** No había nada anterior a las cuentas. Se deja constancia para no volver a mirar. */
  | { status: 'sin-datos' }
  /** Otra cuenta ya recibió esos datos, o esta misma en un arranque anterior. */
  | { status: 'ya-migrado'; migratedTo: string }
  /** Se copiaron estas claves al espacio del usuario. */
  | { status: 'migrado'; copied: readonly string[] }
  /** El medio falló. Nada se ha destruido y no se ha marcado nada. */
  | { status: 'fallo' };

type MigrationMark = { migratedTo: string; at: number; copied: string[] };

function parseMark(raw: string | null): MigrationMark | null {
  if (raw === null) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null) return null;
    const mark = value as Record<string, unknown>;
    if (typeof mark.migratedTo !== 'string' || mark.migratedTo === '') return null;
    return {
      migratedTo: mark.migratedTo,
      at: typeof mark.at === 'number' ? mark.at : 0,
      copied: Array.isArray(mark.copied) ? mark.copied.filter((k): k is string => typeof k === 'string') : [],
    };
  } catch {
    // Una marca ilegible es peor que ninguna: si se ignorara, unos datos que quizá ya se
    // entregaron podrían entregarse otra vez a una cuenta distinta. Se trata como marca.
    return { migratedTo: 'desconocido', at: 0, copied: [] };
  }
}

/** Destino de una clave anterior a las cuentas dentro del espacio del usuario. */
function targetKeyFor(legacyKey: string, userId: string): string | null {
  if (legacyKey === LEGACY_LIBRARY_KEY) {
    return libraryKeyFor(userId);
  }
  if (legacyKey.startsWith(`${LEGACY_HISTORY_PREFIX}:`)) {
    return `${historyPrefixFor(userId)}${legacyKey.slice(LEGACY_HISTORY_PREFIX.length)}`;
  }
  return null;
}

/** Las claves anteriores a las cuentas que hay ahora mismo en el medio. */
export async function findLegacyKeys(storage: MigrationStore): Promise<string[]> {
  const keys = await storage.getAllKeys();
  return keys
    .filter((key) => key === LEGACY_LIBRARY_KEY || key.startsWith(`${LEGACY_HISTORY_PREFIX}:`))
    .slice()
    .sort();
}

export async function migrateLegacyData(
  userId: string,
  storage: MigrationStore = AsyncStorage,
  now: () => number = Date.now,
): Promise<LegacyMigrationResult> {
  let mark: MigrationMark | null;
  let legacyKeys: string[];
  try {
    mark = parseMark(await storage.getItem(LEGACY_MIGRATION_KEY));
    if (mark !== null) {
      return { status: 'ya-migrado', migratedTo: mark.migratedTo };
    }
    legacyKeys = await findLegacyKeys(storage);
  } catch {
    return { status: 'fallo' };
  }

  const writeMark = async (copied: string[]): Promise<boolean> => {
    try {
      const value: MigrationMark = { migratedTo: userId, at: now(), copied };
      await storage.setItem(LEGACY_MIGRATION_KEY, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  };

  if (legacyKeys.length === 0) {
    return (await writeMark([])) ? { status: 'sin-datos' } : { status: 'fallo' };
  }

  const copied: string[] = [];
  try {
    for (const legacyKey of legacyKeys) {
      const target = targetKeyFor(legacyKey, userId);
      if (target === null) continue;

      const value = await storage.getItem(legacyKey);
      if (value === null) continue;

      // El destino manda: si el usuario ya tiene contenido propio ahí, no se pisa.
      const existing = await storage.getItem(target);
      if (existing !== null) continue;

      await storage.setItem(target, value);
      copied.push(target);

      // Se relee del medio antes de dar la copia por buena. Un `setItem` que se resuelve no
      // demuestra que el dato esté guardado; volver a leerlo, sí.
      const written = await storage.getItem(target);
      if (written !== value) {
        return { status: 'fallo' };
      }
    }
  } catch {
    // Los originales siguen donde estaban y la marca no se ha escrito: el próximo arranque
    // volverá a intentarlo.
    return { status: 'fallo' };
  }

  return (await writeMark(copied)) ? { status: 'migrado', copied } : { status: 'fallo' };
}
