import {
  historyPrefixFor,
  libraryKeyFor,
  LEGACY_HISTORY_PREFIX,
  LEGACY_LIBRARY_KEY,
  LEGACY_MIGRATION_KEY,
  userPrefix,
} from '../../src/lib/storage/keys';

/**
 * El espacio de nombres de cada cuenta.
 *
 * Es la pieza de la que depende todo el aislamiento: si dos usuarios pudieran generar la
 * misma clave, no habría aislamiento por mucho que la interfaz filtrara.
 */

describe('Claves por usuario', () => {
  it('la biblioteca y el historial llevan el identificador', () => {
    expect(libraryKeyFor('4f3a-1111')).toBe('flashcards:user:4f3a-1111:library:v1');
    expect(historyPrefixFor('4f3a-1111')).toBe('flashcards:user:4f3a-1111:history:v1');
  });

  it('dos usuarios nunca comparten clave', () => {
    expect(libraryKeyFor('usuario-a')).not.toBe(libraryKeyFor('usuario-b'));
    expect(historyPrefixFor('usuario-a')).not.toBe(historyPrefixFor('usuario-b'));
    expect(userPrefix('usuario-a')).not.toBe(userPrefix('usuario-b'));
  });

  it('la biblioteca y el historial de un mismo usuario salen del mismo prefijo', () => {
    // Es lo que impide que la biblioteca sea de una cuenta y el historial de otra.
    expect(libraryKeyFor('u').startsWith(userPrefix('u'))).toBe(true);
    expect(historyPrefixFor('u').startsWith(userPrefix('u'))).toBe(true);
  });

  it('la identidad es el user.id, no el correo', () => {
    // Dos identificadores distintos con el mismo correo son dos espacios distintos, y el
    // mismo identificador con dos correos es el mismo espacio: el correo no pinta nada.
    expect(libraryKeyFor('id-1')).not.toContain('@');
    expect(libraryKeyFor('id-1')).not.toBe(libraryKeyFor('id-2'));
  });

  it('un identificador que podría fabricar la clave de otro se rechaza', () => {
    // Sin esta comprobación, "a:library:v1" produciría la clave de otro espacio.
    expect(() => libraryKeyFor('usuario-a:history:v1:month')).toThrow();
    expect(() => historyPrefixFor('')).toThrow();
    expect(() => userPrefix('   ')).toThrow();
  });
});

describe('Claves anteriores a las cuentas', () => {
  it('son las que la aplicación usaba hasta TASK-007', () => {
    expect(LEGACY_LIBRARY_KEY).toBe('flashcards:library:v1');
    expect(LEGACY_HISTORY_PREFIX).toBe('flashcards:history:v1');
  });

  it('ninguna cuenta puede generarlas', () => {
    for (const id of ['usuario-a', 'x', '4f3a']) {
      expect(libraryKeyFor(id)).not.toBe(LEGACY_LIBRARY_KEY);
      expect(historyPrefixFor(id)).not.toBe(LEGACY_HISTORY_PREFIX);
    }
  });

  it('la marca de migración es global, no de un usuario', () => {
    expect(LEGACY_MIGRATION_KEY).toBe('flashcards:legacy-migration:v1');
    expect(LEGACY_MIGRATION_KEY).not.toContain('user');
  });
});
