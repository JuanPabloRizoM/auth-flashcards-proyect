import {
  emptyPartition,
  HISTORY_META_KEY,
  HISTORY_VERSION,
  isMonthKey,
  mergeHistory,
  monthKey,
  monthOfEntry,
  parseMeta,
  parsePartition,
  serializeMeta,
  serializePartition,
  upsertById,
} from '../../src/lib/storage/historySerialization';
import { createMemoryHistoryRepository } from '../../src/lib/storage/studyHistoryRepository';
import { alta, evento, resetSequence, sesion, snapshot } from '../fixtures/stats/builders';

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
    expect(monthKey('2026-08')).toBe('flashcards:history:v1:month:2026-08');
    expect(isMonthKey('flashcards:history:v1:month:2026-08')).toBe(true);
    expect(isMonthKey(HISTORY_META_KEY)).toBe(false);
    expect(isMonthKey('flashcards:library:v1')).toBe(false);
    expect(isMonthKey('flashcards:history:v1:month:agosto')).toBe(false);
  });

  it('cada registro sabe a qué mes pertenece por su día local', () => {
    expect(monthOfEntry(evento({ deckId: 'mazo-a', day: '2026-08-31' }))).toBe('2026-08');
    expect(monthOfEntry(evento({ deckId: 'mazo-a', day: '2026-09-01' }))).toBe('2026-09');
  });
});

describe('Serialización', () => {
  it('los metadatos van y vuelven intactos', () => {
    const meta = { trackedSince: 1_766_000_000_000, decks: [snapshot('mazo-a', 'Inglés')] };
    expect(parseMeta(serializeMeta(meta))).toEqual(meta);
  });

  it('una partición va y vuelve intacta', () => {
    const partition = {
      month: '2026-08',
      sessions: [sesion({ deckId: 'mazo-a', day: '2026-08-20' })],
      cardEvents: [evento({ deckId: 'mazo-a', day: '2026-08-20' })],
      cardAdditions: [alta({ deckId: 'mazo-a', cardId: 'c-1', day: '2026-08-20' })],
    };
    expect(parsePartition('2026-08', serializePartition(partition))).toEqual(partition);
  });

  it('el documento declara su versión', () => {
    expect(JSON.parse(serializeMeta({ trackedSince: null, decks: [] })).version).toBe(
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
    const history = mergeHistory({ trackedSince: 1, decks: [] }, [
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
    const repository = createMemoryHistoryRepository();

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
    const repository = createMemoryHistoryRepository();
    expect(await repository.load()).toEqual({ status: 'empty' });
  });

  it('el inicio del tracking se fija una vez y no se mueve después', async () => {
    const repository = createMemoryHistoryRepository();

    await repository.append({ trackedSince: 1_000 });
    await repository.append({ trackedSince: 9_999_999 });

    const result = await repository.load();
    expect(result.status).toBe('ok');
    expect(result.status === 'ok' && result.history.trackedSince).toBe(1_000);
  });

  it('el snapshot de un mazo avanza al renombrarlo y no crea un historial nuevo', async () => {
    const repository = createMemoryHistoryRepository();

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
    const repository = createMemoryHistoryRepository();

    await repository.append({ deckSnapshots: [snapshot('mazo-a', 'English', '2026-08-22')] });
    await repository.append({ deckSnapshots: [snapshot('mazo-a', 'Inglés', '2026-08-01')] });

    const result = await repository.load();
    expect(result.status === 'ok' && result.history.deckSnapshots[0]?.name).toBe('English');
  });

  it('un mes dañado se omite e informa, y los demás se siguen leyendo intactos', async () => {
    const repository = createMemoryHistoryRepository();
    await repository.append({
      trackedSince: 1_000,
      cardEvents: [
        evento({ deckId: 'mazo-a', day: '2026-07-15' }),
        evento({ deckId: 'mazo-a', day: '2026-08-20' }),
      ],
    });

    const dañado = createMemoryHistoryRepository({
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
    const repository = createMemoryHistoryRepository();
    await repository.append({
      trackedSince: 1_000,
      cardEvents: [evento({ deckId: 'mazo-a', day: '2026-08-20' })],
    });

    const conMetaRota = createMemoryHistoryRepository({
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
    const repository = createMemoryHistoryRepository({ [monthKey('2025-01')]: partition });

    const result = await repository.load();
    expect(result.status).toBe('ok');
    expect(result.status === 'ok' && result.history.cardEvents).toHaveLength(1);
  });
});
