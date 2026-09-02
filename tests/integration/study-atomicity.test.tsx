import { act, fireEvent, screen } from 'expo-router/testing-library';

import { newScheduling } from '../../src/features/scheduler/types';
import { commitReview } from '../../src/features/study/review';
import { createTestClock } from '../../src/lib/clock';
import { createMemoryHistoryRepository } from '../../src/lib/storage/studyHistoryRepository';
import { createMemoryRepository } from '../../src/lib/storage/memoryRepository';
import type { LibraryRepository, LoadResult } from '../../src/lib/storage/types';
import type { Library } from '../../src/types/domain';
import { abrirMazo, anadirCarta, crearMazo, irA, montarApp, PREFIJO_HISTORIAL } from './statsHarness';

/**
 * Consistencia al calificar.
 *
 * Calificar toca dos almacenes que no comparten transacción: la biblioteca, donde vive la
 * programación, y el historial, donde vive el registro. Lo que no puede pasar es acabar con
 * la tarjeta reprogramada y sin registro, o al revés, y menos aún avanzar a la carta
 * siguiente como si no hubiera pasado nada.
 *
 * La estrategia —escribir la biblioteca, después el historial, y revertir la biblioteca si
 * el historial falla— está en `src/features/study/review.ts` y documentada en
 * docs/DATABASE.md.
 */

const INICIO = '2026-03-10T09:00:00.000Z';

/** Repositorio de biblioteca que lee bien y falla al guardar a partir de la enésima vez. */
function repositorioQueFallaAlGuardar(aPartirDe: number): LibraryRepository & {
  peek: () => string | null;
  guardados: () => number;
} {
  const base = createMemoryRepository();
  let intentos = 0;
  return {
    peek: base.peek,
    guardados: () => intentos,
    load: (): Promise<LoadResult> => base.load(),
    async save(library: Library): Promise<void> {
      intentos += 1;
      if (intentos >= aPartirDe) {
        throw new Error('el medio falló al escribir la biblioteca');
      }
      await base.save(library);
    },
  };
}

/** Historial que registra bien hasta que se le dice que empiece a fallar. */
function historialConInterruptor() {
  const base = createMemoryHistoryRepository(PREFIJO_HISTORIAL);
  let falla = false;
  return {
    ...base,
    romper: () => {
      falla = true;
    },
    arreglar: () => {
      falla = false;
    },
    async append(patch: Parameters<typeof base.append>[0]): Promise<void> {
      if (falla) throw new Error('el medio falló al escribir el historial');
      return base.append(patch);
    },
  };
}

async function prepararSesion(entorno: {
  clock: ReturnType<typeof createTestClock>;
  libraryRepository: LibraryRepository;
  historyRepository: ReturnType<typeof historialConInterruptor>;
}) {
  montarApp(entorno);
  await screen.findByTestId('create-deck-button');
  await crearMazo('Inglés');
  await abrirMazo('mazo-1');
  await anadirCarta('frente 0', 'reverso 0');
  await anadirCarta('frente 1', 'reverso 1');
  await irA('study-button');
  await screen.findByTestId('study-card');
}

async function calificarBien() {
  await act(async () => {
    fireEvent.press(screen.getByTestId('reveal-button'));
  });
  await act(async () => {
    fireEvent.press(screen.getByTestId('rate-good'));
  });
}

describe('Fallo al guardar la programación', () => {
  it('no registra la revisión, no avanza de tarjeta y lo explica', async () => {
    const clock = createTestClock(INICIO);
    // Las tres primeras escrituras son crear el mazo y las dos cartas; la cuarta, la
    // calificación, es la que falla.
    const libraryRepository = repositorioQueFallaAlGuardar(4);
    const historyRepository = historialConInterruptor();
    await prepararSesion({ clock, libraryRepository, historyRepository });

    expect(screen.getByText('frente 0')).toBeTruthy();
    await calificarBien();

    // La carta sigue a la vista: no se avanza en silencio.
    expect(screen.getByText('frente 0')).toBeTruthy();
    expect(screen.getByTestId('study-error')).toBeTruthy();

    // Y no hay ningún registro de revisión.
    await historyRepository.flush();
    const history = await historyRepository.load();
    if (history.status !== 'ok' && history.status !== 'partial') throw new Error('ilegible');
    expect(history.history.reviews).toHaveLength(0);

    // La programación guardada sigue siendo la de una carta nueva.
    const library = await libraryRepository.load();
    if (library.status !== 'ok') throw new Error('ilegible');
    expect(library.library.cards[0]?.scheduling).toEqual(newScheduling);
  });
});

describe('Fallo al registrar la revisión', () => {
  it('revierte la programación ya guardada y no avanza de tarjeta', async () => {
    const clock = createTestClock(INICIO);
    const libraryRepository = createMemoryRepository();
    const historyRepository = historialConInterruptor();
    await prepararSesion({ clock, libraryRepository, historyRepository });

    historyRepository.romper();
    await calificarBien();

    // La carta sigue a la vista y se avisa.
    expect(screen.getByText('frente 0')).toBeTruthy();
    expect(screen.getByTestId('study-error')).toBeTruthy();

    // La biblioteca ha vuelto a su estado anterior: no queda programada sin registro.
    const library = await libraryRepository.load();
    if (library.status !== 'ok') throw new Error('ilegible');
    expect(library.library.cards[0]?.scheduling).toEqual(newScheduling);
  });

  it('no deja nunca programación aplicada sin registro, ni registro sin programación', async () => {
    const clock = createTestClock(INICIO);
    const libraryRepository = createMemoryRepository();
    const historyRepository = historialConInterruptor();
    await prepararSesion({ clock, libraryRepository, historyRepository });

    // Primera calificación buena, segunda con el historial roto.
    await calificarBien();
    historyRepository.romper();
    await calificarBien();

    await historyRepository.flush().catch(() => undefined);
    const history = await historyRepository.load();
    if (history.status !== 'ok' && history.status !== 'partial') throw new Error('ilegible');
    const library = await libraryRepository.load();
    if (library.status !== 'ok') throw new Error('ilegible');

    const programadas = library.library.cards.filter(
      (card) => card.scheduling.state !== 'nueva',
    );

    // Exactamente una tarjeta programada y exactamente un registro: van a la par.
    expect(programadas).toHaveLength(1);
    expect(history.history.reviews).toHaveLength(1);
    expect(history.history.reviews[0]?.cardId).toBe(programadas[0]?.id);
  });
});

describe('Reintentar después de un fallo', () => {
  it('no duplica la revisión: el identificador es estable entre intentos', async () => {
    const clock = createTestClock(INICIO);
    const libraryRepository = createMemoryRepository();
    const historyRepository = historialConInterruptor();
    await prepararSesion({ clock, libraryRepository, historyRepository });

    // Primer intento con el historial roto: se revierte y la carta sigue a la vista.
    historyRepository.romper();
    await calificarBien();
    expect(screen.getByTestId('study-error')).toBeTruthy();

    // Tras el fallo la respuesta sigue revelada y los botones siguen ahí: reintentar es
    // pulsar el mismo, sin volver a revelar.
    historyRepository.arreglar();
    await act(async () => {
      fireEvent.press(screen.getByTestId('rate-good'));
    });

    await historyRepository.flush();
    const history = await historyRepository.load();
    if (history.status !== 'ok' && history.status !== 'partial') throw new Error('ilegible');

    // Una sola revisión y un solo evento de carta, pese a los dos intentos.
    expect(history.history.reviews).toHaveLength(1);
    expect(history.history.cardEvents).toHaveLength(1);

    const library = await libraryRepository.load();
    if (library.status !== 'ok') throw new Error('ilegible');
    expect(library.library.cards[0]?.scheduling.reps).toBe(1);
  });
});

describe('commitReview', () => {
  const outcome = {
    rating: 'bien' as const,
    scheduling: { ...newScheduling, state: 'aprendiendo' as const, due: 1, reps: 1 },
    intervalMs: 600_000,
  };
  const entrada = { cardId: 'carta-1', previous: newScheduling, outcome };

  it('con las dos escrituras bien, confirma', async () => {
    const escrituras: string[] = [];
    const resultado = await commitReview(
      {
        saveScheduling: async () => {
          escrituras.push('biblioteca');
          return true;
        },
        recordReview: async () => {
          escrituras.push('historial');
          return true;
        },
      },
      entrada,
    );

    expect(resultado.status).toBe('ok');
    // El orden importa: primero la programación, después el registro.
    expect(escrituras).toEqual(['biblioteca', 'historial']);
  });

  it('si falla la biblioteca no llega a tocar el historial', async () => {
    let registros = 0;
    const resultado = await commitReview(
      {
        saveScheduling: async () => false,
        recordReview: async () => {
          registros += 1;
          return true;
        },
      },
      entrada,
    );

    expect(resultado.status).toBe('scheduling-failed');
    expect(registros).toBe(0);
  });

  it('si falla el historial revierte la programación al valor anterior', async () => {
    const guardado: unknown[] = [];
    const resultado = await commitReview(
      {
        saveScheduling: async (_cardId, scheduling) => {
          guardado.push(scheduling);
          return true;
        },
        recordReview: async () => false,
      },
      entrada,
    );

    expect(resultado.status).toBe('log-failed');
    expect(guardado).toEqual([outcome.scheduling, newScheduling]);
  });

  it('si tampoco se puede revertir, lo dice en vez de callarlo', async () => {
    let intentos = 0;
    const resultado = await commitReview(
      {
        saveScheduling: async () => {
          intentos += 1;
          return intentos === 1;
        },
        recordReview: async () => false,
      },
      entrada,
    );

    expect(resultado.status).toBe('inconsistent');
  });
});
