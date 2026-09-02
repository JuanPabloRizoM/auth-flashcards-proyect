import {
  emptyPartition,
  historyKeys,
  HISTORY_VERSION,
  mergeHistory,
  monthOfEntry,
  parseMeta,
  parsePartition,
  serializeMeta,
  serializePartition,
  upsertById,
} from '../../src/lib/storage/historySerialization';
import { historyPrefixFor } from '../../src/lib/storage/keys';
import {
  createMemoryHistoryRepository,
  createStudyHistoryRepository,
} from '../../src/lib/storage/studyHistoryRepository';
import { alta, evento, resetSequence, revision, sesion, snapshot } from '../fixtures/stats/builders';

/**
 * Todo el historial vive bajo el espacio de nombres de un usuario (TASK-008). Los tests usan
 * uno fijo para poder afirmar sobre claves concretas.
 */
const PREFIJO = historyPrefixFor('usuario-a');
const claves = historyKeys(PREFIJO);
const HISTORY_META_KEY = claves.meta;
const monthKey = claves.month;
const isMonthKey = claves.isMonth;

/**
 * Formato y particionado del historial.
 *
 * Lo que se demuestra aquí es lo que hace que el historial pueda crecer sin volverse
 * inmanejable: cada mes vive en su propio documento, escribir toca solo el mes implicado, y
 * un mes ilegible no se lleva por delante el resto ni se borra.
 */

beforeEach(resetSequence);

describe('Claves y particiones', () => {
  it('la clave de un mes es reconocible y reversible', () => {
    expect(monthKey('2026-08')).toBe('flashcards:user:usuario-a:history:v1:month:2026-08');
    expect(isMonthKey('flashcards:user:usuario-a:history:v1:month:2026-08')).toBe(true);
    expect(isMonthKey(HISTORY_META_KEY)).toBe(false);
    expect(isMonthKey('flashcards:user:usuario-a:library:v1')).toBe(false);
    expect(isMonthKey('flashcards:user:usuario-a:history:v1:month:agosto')).toBe(false);
    // La bitácora de otra cuenta no es de esta.
    expect(isMonthKey('flashcards:user:usuario-b:history:v1:month:2026-08')).toBe(false);
  });

  it('cada registro sabe a qué mes pertenece por su día local', () => {
    expect(monthOfEntry(evento({ deckId: 'mazo-a', day: '2026-08-31' }))).toBe('2026-08');
    expect(monthOfEntry(evento({ deckId: 'mazo-a', day: '2026-09-01' }))).toBe('2026-09');
  });
});

describe('Serialización', () => {
  it('los metadatos van y vuelven intactos', () => {
    const meta = { trackedSince: 1_766_000_000_000, ratedSince: null, decks: [snapshot('mazo-a', 'Inglés')] };
    expect(parseMeta(serializeMeta(meta))).toEqual(meta);
  });

  it('una partición va y vuelve intacta', () => {
    const partition = {
      month: '2026-08',
      sessions: [sesion({ deckId: 'mazo-a', day: '2026-08-20' })],
      cardEvents: [evento({ deckId: 'mazo-a', day: '2026-08-20' })],
      cardAdditions: [alta({ deckId: 'mazo-a', cardId: 'c-1', day: '2026-08-20' })],
      reviews: [revision({ deckId: 'mazo-a', cardId: 'c-1', day: '2026-08-20' })],
    };
    expect(parsePartition('2026-08', serializePartition(partition))).toEqual(partition);
  });

  it('el documento declara su versión', () => {
    expect(JSON.parse(serializeMeta({ trackedSince: null, ratedSince: null, decks: [] })).version).toBe(
      HISTORY_VERSION,
    );
    expect(JSON.parse(serializePartition(emptyPartition('2026-08'))).version).toBe(HISTORY_VERSION);
  });
});

describe('Contenido no legible', () => {
  const basura = [
    ['nada guardado', null],
    ['cadena vacía', ''],
    ['JSON roto', '{"version":1,'],
    ['no es un objeto', '[]'],
    ['versión desconocida', '{"version":99,"sessions":[],"cardEvents":[],"cardAdditions":[]}'],
  ] as const;

  it.each(basura)('una partición con %s se rechaza sin lanzar', (_caso, raw) => {
    expect(parsePartition('2026-08', raw)).toBeNull();
  });

  it('rechaza un evento sin los campos obligatorios', () => {
    const raw = JSON.stringify({
      version: HISTORY_VERSION,
      month: '2026-08',
      sessions: [],
      cardEvents: [{ id: 'e-1', deckId: 'mazo-a' }],
      cardAdditions: [],
    });
    expect(parsePartition('2026-08', raw)).toBeNull();
  });

  it('rechaza un día local con forma imposible', () => {
    const roto = { ...evento({ deckId: 'mazo-a', day: '2026-08-20' }), localDay: '2026-02-31' };
    const raw = JSON.stringify({
      version: HISTORY_VERSION,
      month: '2026-08',
      sessions: [],
      cardEvents: [roto],
      cardAdditions: [],
    });
    expect(parsePartition('2026-08', raw)).toBeNull();
  });

  it('rechaza una hora local fuera de rango', () => {
    const roto = { ...evento({ deckId: 'mazo-a', day: '2026-08-20' }), localHour: 24 };
    const raw = JSON.stringify({
      version: HISTORY_VERSION,
      month: '2026-08',
      sessions: [],
      cardEvents: [roto],
      cardAdditions: [],
    });
    expect(parsePartition('2026-08', raw)).toBeNull();
  });

  it('rechaza un origen que no existe, en vez de aceptarlo como válido', () => {
    const roto = { ...alta({ deckId: 'mazo-a', cardId: 'c-1', day: '2026-08-20' }), origin: 'ia' };
    const raw = JSON.stringify({
      version: HISTORY_VERSION,
      month: '2026-08',
      sessions: [],
      cardEvents: [],
      cardAdditions: [roto],
    });
    expect(parsePartition('2026-08', raw)).toBeNull();
  });
});

describe('Mezcla', () => {
  it('ordena las particiones por mes al reunirlas', () => {
    const history = mergeHistory({ trackedSince: 1, ratedSince: null, decks: [] }, [
      { ...emptyPartition('2026-09'), cardEvents: [evento({ deckId: 'a', day: '2026-09-01' })] },
      { ...emptyPartition('2026-07'), cardEvents: [evento({ deckId: 'a', day: '2026-07-01' })] },
    ]);

    expect(history.cardEvents.map((event) => event.localDay)).toEqual([
      '2026-07-01',
      '2026-09-01',
    ]);
  });

  it('reemplaza por id en vez de duplicar', () => {
    const original = sesion({ deckId: 'mazo-a', day: '2026-08-20', id: 's-1', completedCards: 1 });
    const actualizada = { ...original, completedCards: 5 };

    const resultado = upsertById([original], [actualizada]);

    expect(resultado).toHaveLength(1);
    expect(resultado[0]?.completedCards).toBe(5);
  });
});

describe('Repositorio particionado', () => {
  it('escribe cada mes en su propia clave y no toca los demás', async () => {
    const repository = createMemoryHistoryRepository(PREFIJO);

    await repository.append({
      trackedSince: 1_766_000_000_000,
      cardEvents: [
        evento({ deckId: 'mazo-a', day: '2026-07-15' }),
        evento({ deckId: 'mazo-a', day: '2026-08-20' }),
      ],
    });

    const claves = Object.keys(repository.peek()).sort();
    expect(claves).toEqual([
      HISTORY_META_KEY,
      monthKey('2026-07'),
      monthKey('2026-08'),
    ]);

    const julioAntes = repository.peek()[monthKey('2026-07')];
    await repository.append({ cardEvents: [evento({ deckId: 'mazo-a', day: '2026-08-21' })] });

    // Escribir en agosto deja julio byte a byte como estaba: es lo que acota el coste.
    expect(repository.peek()[monthKey('2026-07')]).toBe(julioAntes);
  });

  it('un primer arranque sin nada guardado se reporta como vacío', async () => {
    const repository = createMemoryHistoryRepository(PREFIJO);
    expect(await repository.load()).toEqual({ status: 'empty' });
  });

  it('el inicio del tracking se fija una vez y no se mueve después', async () => {
    const repository = createMemoryHistoryRepository(PREFIJO);

    await repository.append({ trackedSince: 1_000 });
    await repository.append({ trackedSince: 9_999_999 });

    const result = await repository.load();
    expect(result.status).toBe('ok');
    expect(result.status === 'ok' && result.history.trackedSince).toBe(1_000);
  });

  it('el snapshot de un mazo avanza al renombrarlo y no crea un historial nuevo', async () => {
    const repository = createMemoryHistoryRepository(PREFIJO);

    await repository.append({
      trackedSince: 1_000,
      deckSnapshots: [snapshot('mazo-a', 'Inglés', '2026-08-01')],
      cardEvents: [evento({ deckId: 'mazo-a', day: '2026-08-20' })],
    });
    await repository.append({ deckSnapshots: [snapshot('mazo-a', 'English', '2026-08-22')] });

    const result = await repository.load();
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;

    expect(result.history.deckSnapshots).toHaveLength(1);
    expect(result.history.deckSnapshots[0]?.name).toBe('English');
    // El historial sigue siendo uno solo, atribuido al mismo id.
    expect(result.history.cardEvents).toHaveLength(1);
    expect(result.history.cardEvents[0]?.deckId).toBe('mazo-a');
  });

  it('un snapshot más viejo no pisa a uno más reciente', async () => {
    const repository = createMemoryHistoryRepository(PREFIJO);

    await repository.append({ deckSnapshots: [snapshot('mazo-a', 'English', '2026-08-22')] });
    await repository.append({ deckSnapshots: [snapshot('mazo-a', 'Inglés', '2026-08-01')] });

    const result = await repository.load();
    expect(result.status === 'ok' && result.history.deckSnapshots[0]?.name).toBe('English');
  });

  it('un mes dañado se omite e informa, y los demás se siguen leyendo intactos', async () => {
    const repository = createMemoryHistoryRepository(PREFIJO);
    await repository.append({
      trackedSince: 1_000,
      cardEvents: [
        evento({ deckId: 'mazo-a', day: '2026-07-15' }),
        evento({ deckId: 'mazo-a', day: '2026-08-20' }),
      ],
    });

    const dañado = createMemoryHistoryRepository(PREFIJO, {
      ...repository.peek(),
      [monthKey('2026-07')]: '{"version":1, roto',
    });

    const result = await dañado.load();
    expect(result.status).toBe('partial');
    if (result.status !== 'partial') return;

    expect(result.damagedMonths).toEqual(['2026-07']);
    expect(result.history.cardEvents).toHaveLength(1);
    expect(result.history.cardEvents[0]?.localDay).toBe('2026-08-20');
    // Nada se ha borrado: el mes dañado sigue exactamente donde estaba.
    expect(dañado.peek()[monthKey('2026-07')]).toBe('{"version":1, roto');
  });

  it('sobrevive a que los metadatos sean ilegibles sin perder los eventos', async () => {
    const repository = createMemoryHistoryRepository(PREFIJO);
    await repository.append({
      trackedSince: 1_000,
      cardEvents: [evento({ deckId: 'mazo-a', day: '2026-08-20' })],
    });

    const conMetaRota = createMemoryHistoryRepository(PREFIJO, {
      ...repository.peek(),
      [HISTORY_META_KEY]: 'no es json',
    });

    const result = await conMetaRota.load();
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;

    expect(result.history.cardEvents).toHaveLength(1);
    // Lo que se perdió fue la fecha de inicio, y se reconoce desconocida en vez de inventarse.
    expect(result.history.trackedSince).toBeNull();
  });

  it('no descubre las particiones por un índice: encuentra un mes que nadie anunció', async () => {
    const partition = serializePartition({
      ...emptyPartition('2025-01'),
      cardEvents: [evento({ deckId: 'mazo-a', day: '2025-01-05' })],
    });
    const repository = createMemoryHistoryRepository(PREFIJO, { [monthKey('2025-01')]: partition });

    const result = await repository.load();
    expect(result.status).toBe('ok');
    expect(result.status === 'ok' && result.history.cardEvents).toHaveLength(1);
  });
});

/**
 * Migración del historial de la versión 1 a la 2.
 *
 * La versión 1 es la de TASK-006: sesiones, eventos y altas, sin calificaciones. La 2 añade
 * `reviews` a cada partición y `ratedSince` a los metadatos. Lo importante es que lo
 * anterior se conserva íntegro y que **no se le inventa ninguna calificación**: los eventos
 * de TASK-006 dicen que una carta se estudió, no cómo salió.
 */
describe('migración del historial a la versión 2', () => {
  /** Instante de referencia: cuando se activó el tracking en la versión anterior. */
  const T0 = Date.parse('2026-08-01T08:00:00.000Z');

  const metaV1 = JSON.stringify({
    version: 1,
    trackedSince: T0,
    decks: [{ deckId: 'mazo-a', name: 'Inglés', lastSeenAt: T0 }],
  });

  const particionV1 = JSON.stringify({
    version: 1,
    month: '2026-08',
    sessions: [sesion({ deckId: 'mazo-a', day: '2026-08-20' })],
    cardEvents: [evento({ deckId: 'mazo-a', day: '2026-08-20', cardId: 'c-1' })],
    cardAdditions: [alta({ deckId: 'mazo-a', cardId: 'c-1', day: '2026-08-20' })],
  });

  it('los metadatos de la versión 1 se leen y no traen fecha de calificación', () => {
    const meta = parseMeta(metaV1);

    expect(meta).not.toBeNull();
    expect(meta!.trackedSince).toBe(T0);
    expect(meta!.ratedSince).toBeNull();
    expect(meta!.decks).toHaveLength(1);
  });

  it('una partición de la versión 1 se lee con la lista de calificaciones vacía', () => {
    const partition = parsePartition('2026-08', particionV1);

    expect(partition).not.toBeNull();
    expect(partition!.reviews).toEqual([]);
    expect(partition!.sessions).toHaveLength(1);
    expect(partition!.cardEvents).toHaveLength(1);
    expect(partition!.cardAdditions).toHaveLength(1);
  });

  it('no se fabrica ninguna calificación a partir de la actividad anterior', () => {
    const partition = parsePartition('2026-08', particionV1)!;

    expect(partition.reviews).toHaveLength(0);
    expect(partition.cardEvents[0]?.cardId).toBe('c-1');
  });

  it('al volver a escribir, el documento ya es de la versión actual', () => {
    const partition = parsePartition('2026-08', particionV1)!;
    const reescrito = JSON.parse(serializePartition(partition));

    expect(reescrito.version).toBe(HISTORY_VERSION);
    expect(HISTORY_VERSION).toBe(2);
    expect(reescrito.reviews).toEqual([]);
  });

  it('el historial completo se recompone conservando lo anterior', () => {
    const history = mergeHistory(parseMeta(metaV1)!, [parsePartition('2026-08', particionV1)!]);

    expect(history.trackedSince).toBe(T0);
    expect(history.ratedSince).toBeNull();
    expect(history.reviews).toEqual([]);
    expect(history.sessions).toHaveLength(1);
    expect(history.cardEvents).toHaveLength(1);
    expect(history.cardAdditions).toHaveLength(1);
    expect(history.deckSnapshots).toHaveLength(1);
  });

  it('una calificación con forma inesperada invalida la partición en vez de leerse a medias', () => {
    const roto = JSON.stringify({
      version: HISTORY_VERSION,
      month: '2026-08',
      sessions: [],
      cardEvents: [],
      cardAdditions: [],
      reviews: [{ id: 'r-1', rating: 'excelente' }],
    });

    expect(parsePartition('2026-08', roto)).toBeNull();
  });

  it('el registro de calificaciones sobrevive al ciclo completo de serialización', () => {
    const review = revision({ deckId: 'mazo-a', cardId: 'c-1', day: '2026-08-20', rating: 'dificil' });
    const partition = {
      month: '2026-08',
      sessions: [],
      cardEvents: [],
      cardAdditions: [],
      reviews: [review],
    };

    const recuperado = parsePartition('2026-08', serializePartition(partition))!;

    expect(recuperado.reviews[0]).toEqual(review);
    expect(recuperado.reviews[0]?.rating).toBe('dificil');
    expect(recuperado.reviews[0]?.previousState).toBe('repaso');
    expect(recuperado.reviews[0]?.newState).toBe('repaso');
    expect(recuperado.reviews[0]?.previousDue).toBe(review.previousDue);
    expect(recuperado.reviews[0]?.newDue).toBe(review.newDue);
    expect(recuperado.reviews[0]?.previousIntervalDays).toBe(review.previousIntervalDays);
    expect(recuperado.reviews[0]?.newIntervalDays).toBe(review.newIntervalDays);
    expect(recuperado.reviews[0]?.schedulerId).toBe('fsrs');
    expect(recuperado.reviews[0]?.schedulerVersion).toContain('ts-fsrs');
  });

  it('el vencimiento anterior nulo de una carta nueva se conserva como nulo', () => {
    const review = {
      ...revision({ deckId: 'mazo-a', cardId: 'c-1', day: '2026-08-20' }),
      previousState: 'nueva' as const,
      previousDue: null,
      previousIntervalDays: 0,
    };
    const partition = {
      month: '2026-08',
      sessions: [],
      cardEvents: [],
      cardAdditions: [],
      reviews: [review],
    };

    expect(parsePartition('2026-08', serializePartition(partition))!.reviews[0]?.previousDue).toBeNull();
  });
});

/**
 * Orden de escritura e idempotencia.
 *
 * `ratedSince` anuncia en pantalla que existen calificaciones. Escribirlo antes que la
 * partición que las contiene dejaría la aplicación afirmando algo que todavía no está en
 * disco, así que las particiones van primero.
 *
 * Y como una escritura puede quedar a medias y reintentarse, el identificador de una
 * revisión tiene que ser estable: si cambiara en cada intento, una sola respuesta acabaría
 * contando dos veces.
 */
describe('escritura del historial', () => {
  /** Almacenamiento que apunta el orden de las claves escritas. */
  function almacenObservado() {
    const map = new Map<string, string>();
    const escrituras: string[] = [];
    return {
      escrituras,
      store: {
        getItem: async (key: string) => map.get(key) ?? null,
        setItem: async (key: string, value: string) => {
          escrituras.push(key);
          map.set(key, value);
        },
        getAllKeys: async () => [...map.keys()],
      },
    };
  }

  it('escribe la partición del mes antes que los metadatos', async () => {
    const observado = almacenObservado();
    const repositorio = createStudyHistoryRepository(PREFIJO, observado.store);

    await repositorio.append({
      ratedSince: Date.parse('2026-08-20T10:00:00.000Z'),
      reviews: [revision({ deckId: 'mazo-a', cardId: 'c-1', day: '2026-08-20' })],
    });
    await repositorio.flush();

    expect(observado.escrituras).toEqual([monthKey('2026-08'), HISTORY_META_KEY]);
  });

  it('reintentar una revisión con el mismo identificador no la duplica', async () => {
    const repositorio = createMemoryHistoryRepository(PREFIJO);
    const review = revision({
      deckId: 'mazo-a',
      cardId: 'c-1',
      day: '2026-08-20',
      id: 'evento-7-review',
    });

    await repositorio.append({ reviews: [review] });
    // Mismo identificador, como el que produce derivarlo del evento de la carta.
    await repositorio.append({ reviews: [review] });
    await repositorio.flush();

    const result = await repositorio.load();
    if (result.status !== 'ok') throw new Error('historial ilegible');
    expect(result.history.reviews).toHaveLength(1);
  });

  it('dos revisiones distintas sí se guardan las dos', async () => {
    const repositorio = createMemoryHistoryRepository(PREFIJO);

    await repositorio.append({
      reviews: [revision({ deckId: 'mazo-a', cardId: 'c-1', day: '2026-08-20', id: 'evento-7-review' })],
    });
    await repositorio.append({
      reviews: [revision({ deckId: 'mazo-a', cardId: 'c-2', day: '2026-08-20', id: 'evento-8-review' })],
    });
    await repositorio.flush();

    const result = await repositorio.load();
    if (result.status !== 'ok') throw new Error('historial ilegible');
    expect(result.history.reviews).toHaveLength(2);
  });
});
