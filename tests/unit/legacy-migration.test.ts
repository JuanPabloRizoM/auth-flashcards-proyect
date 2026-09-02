import {
  historyPrefixFor,
  libraryKeyFor,
  LEGACY_HISTORY_PREFIX,
  LEGACY_LIBRARY_KEY,
  LEGACY_MIGRATION_KEY,
} from '../../src/lib/storage/keys';
import {
  findLegacyKeys,
  migrateLegacyData,
  type MigrationStore,
} from '../../src/lib/storage/legacyMigration';

/**
 * Entrega de los datos creados antes de que existieran cuentas.
 *
 * Las cinco reglas del módulo, una por una: una sola vez, no destructiva, no sobrescribe,
 * verificada antes de marcar, e idempotente.
 */

const BIBLIOTECA_LEGACY = '{"version":3,"decks":[{"id":"mazo-1"}],"cards":[],"scheduler":null}';
const META_LEGACY = '{"version":2,"trackedSince":1766000000000,"ratedSince":null,"decks":[]}';
const MES_LEGACY = '{"version":2,"month":"2026-08","sessions":[],"cardEvents":[],"cardAdditions":[],"reviews":[]}';

function almacen(inicial: Record<string, string> = {}) {
  const mapa = new Map(Object.entries(inicial));
  let fallarEscritura = false;

  const store: MigrationStore = {
    getItem: async (key) => mapa.get(key) ?? null,
    setItem: async (key, value) => {
      if (fallarEscritura) throw new Error('el medio no acepta escrituras');
      mapa.set(key, value);
    },
    getAllKeys: async () => [...mapa.keys()],
  };

  return {
    store,
    mapa,
    romper: () => {
      fallarEscritura = true;
    },
    contenido: () => Object.fromEntries(mapa),
  };
}

function conDatosPrevios() {
  return almacen({
    [LEGACY_LIBRARY_KEY]: BIBLIOTECA_LEGACY,
    [`${LEGACY_HISTORY_PREFIX}:meta`]: META_LEGACY,
    [`${LEGACY_HISTORY_PREFIX}:month:2026-08`]: MES_LEGACY,
  });
}

describe('Detección', () => {
  it('encuentra la biblioteca y todas las particiones anteriores', async () => {
    const { store } = conDatosPrevios();

    expect(await findLegacyKeys(store)).toEqual([
      LEGACY_HISTORY_PREFIX + ':meta',
      LEGACY_HISTORY_PREFIX + ':month:2026-08',
      LEGACY_LIBRARY_KEY,
    ]);
  });

  it('no confunde las claves de una cuenta con las anteriores a las cuentas', async () => {
    const { store } = almacen({
      [libraryKeyFor('usuario-a')]: BIBLIOTECA_LEGACY,
      [`${historyPrefixFor('usuario-a')}:meta`]: META_LEGACY,
    });

    expect(await findLegacyKeys(store)).toEqual([]);
  });
});

describe('Primer usuario autenticado', () => {
  it('recibe los datos, byte a byte', async () => {
    const { store, contenido } = conDatosPrevios();

    const resultado = await migrateLegacyData('usuario-a', store);

    expect(resultado.status).toBe('migrado');
    const despues = contenido();
    expect(despues[libraryKeyFor('usuario-a')]).toBe(BIBLIOTECA_LEGACY);
    expect(despues[`${historyPrefixFor('usuario-a')}:meta`]).toBe(META_LEGACY);
    expect(despues[`${historyPrefixFor('usuario-a')}:month:2026-08`]).toBe(MES_LEGACY);
  });

  it('no destruye el original', async () => {
    const { store, contenido } = conDatosPrevios();

    await migrateLegacyData('usuario-a', store);

    const despues = contenido();
    expect(despues[LEGACY_LIBRARY_KEY]).toBe(BIBLIOTECA_LEGACY);
    expect(despues[`${LEGACY_HISTORY_PREFIX}:meta`]).toBe(META_LEGACY);
  });

  it('deja constancia de a quién se los dio', async () => {
    const { store, contenido } = conDatosPrevios();

    await migrateLegacyData('usuario-a', store, () => 1_767_000_000_000);

    const marca = JSON.parse(contenido()[LEGACY_MIGRATION_KEY] ?? '{}');
    expect(marca.migratedTo).toBe('usuario-a');
    expect(marca.at).toBe(1_767_000_000_000);
  });

  it('sin nada anterior, deja la marca igualmente y no vuelve a mirar', async () => {
    const { store, contenido } = almacen();

    expect(await migrateLegacyData('usuario-a', store)).toEqual({ status: 'sin-datos' });
    expect(contenido()[LEGACY_MIGRATION_KEY]).toBeDefined();
  });
});

describe('Una segunda cuenta no hereda nada', () => {
  it('lo que era de la primera no aparece en el espacio de la segunda', async () => {
    const { store, contenido } = conDatosPrevios();

    await migrateLegacyData('usuario-a', store);
    const resultado = await migrateLegacyData('usuario-b', store);

    expect(resultado).toEqual({ status: 'ya-migrado', migratedTo: 'usuario-a' });
    expect(contenido()[libraryKeyFor('usuario-b')]).toBeUndefined();
    expect(contenido()[`${historyPrefixFor('usuario-b')}:meta`]).toBeUndefined();
  });

  it('tampoco si la marca quedó ilegible: en la duda, no se reparte', async () => {
    const { store, contenido } = conDatosPrevios();
    await store.setItem(LEGACY_MIGRATION_KEY, 'esto no es json');

    const resultado = await migrateLegacyData('usuario-b', store);

    expect(resultado.status).toBe('ya-migrado');
    expect(contenido()[libraryKeyFor('usuario-b')]).toBeUndefined();
  });
});

describe('Idempotencia', () => {
  it('repetirla no cambia nada', async () => {
    const { store, contenido } = conDatosPrevios();

    await migrateLegacyData('usuario-a', store, () => 1_000);
    const despuesDeLaPrimera = { ...contenido() };

    expect(await migrateLegacyData('usuario-a', store, () => 2_000)).toEqual({
      status: 'ya-migrado',
      migratedTo: 'usuario-a',
    });
    expect(contenido()).toEqual(despuesDeLaPrimera);
  });

  it('no pisa lo que el usuario haya escrito después', async () => {
    const { store, contenido } = conDatosPrevios();
    // El usuario ya tenía biblioteca propia: la migración no puede sustituirla.
    await store.setItem(libraryKeyFor('usuario-a'), '{"version":3,"decks":[],"cards":[],"scheduler":null}');

    const resultado = await migrateLegacyData('usuario-a', store);

    expect(resultado.status).toBe('migrado');
    expect(contenido()[libraryKeyFor('usuario-a')]).toBe(
      '{"version":3,"decks":[],"cards":[],"scheduler":null}',
    );
    // Lo que sí faltaba, se copia.
    expect(contenido()[`${historyPrefixFor('usuario-a')}:meta`]).toBe(META_LEGACY);
  });
});

describe('Cuando el medio falla', () => {
  it('no se destruye nada, no se marca, y el intento siguiente vuelve a empezar', async () => {
    const roto = conDatosPrevios();
    roto.romper();

    expect(await migrateLegacyData('usuario-a', roto.store)).toEqual({ status: 'fallo' });

    const despues = roto.contenido();
    expect(despues[LEGACY_LIBRARY_KEY]).toBe(BIBLIOTECA_LEGACY);
    expect(despues[LEGACY_MIGRATION_KEY]).toBeUndefined();
    expect(despues[libraryKeyFor('usuario-a')]).toBeUndefined();
  });

  it('una copia que no se puede releer no se da por buena', async () => {
    const { store, mapa } = conDatosPrevios();
    // El medio acepta la escritura pero no guarda nada: el caso que un `setItem` resuelto
    // no detecta y una relectura sí.
    const mentiroso: MigrationStore = {
      ...store,
      setItem: async (key) => {
        if (key !== LEGACY_MIGRATION_KEY) return;
        mapa.set(key, 'marcado');
      },
    };

    expect(await migrateLegacyData('usuario-a', mentiroso)).toEqual({ status: 'fallo' });
    expect(mapa.get(LEGACY_MIGRATION_KEY)).toBeUndefined();
  });

  it('un fallo al leer tampoco destruye nada', async () => {
    const { mapa } = conDatosPrevios();
    const ilegible: MigrationStore = {
      getItem: async () => {
        throw new Error('el medio no responde');
      },
      setItem: async () => undefined,
      getAllKeys: async () => [...mapa.keys()],
    };

    expect(await migrateLegacyData('usuario-a', ilegible)).toEqual({ status: 'fallo' });
    expect(mapa.get(LEGACY_LIBRARY_KEY)).toBe(BIBLIOTECA_LEGACY);
  });
});
