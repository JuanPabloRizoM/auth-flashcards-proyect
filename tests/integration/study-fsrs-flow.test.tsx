import { act, fireEvent, screen } from 'expo-router/testing-library';

import { appScheduler } from '../../src/features/scheduler';
import { formatSchedulingInterval } from '../../src/features/scheduler/format';
import { newScheduling, reviewRatings } from '../../src/features/scheduler/types';
import { buildStatsReport } from '../../src/features/stats/engine';
import { localDayOf } from '../../src/features/stats/time';
import type { StudyHistory } from '../../src/features/stats/types';
import { createTestClock } from '../../src/lib/clock';
import { createMemoryHistoryRepository } from '../../src/lib/storage/studyHistoryRepository';
import { createMemoryRepository } from '../../src/lib/storage/memoryRepository';
import type { Library } from '../../src/types/domain';
import {
  abrirMazo,
  anadirCarta,
  calificar,
  crearMazo,
  irA,
  montarApp,
  repositorios,
} from './statsHarness';

/**
 * El estudio con repetición espaciada, de punta a punta.
 *
 * Se conduce la aplicación real por la interfaz y después se lee lo guardado en los
 * repositorios, no el estado de React: lo que se demuestra es que calificar cambia la
 * programación de la tarjeta, lo escribe y lo registra.
 *
 * El reloj se inyecta para poder calificar, adelantarlo y comprobar que una tarjeta
 * programada para dentro de unos días vuelve a estar disponible.
 */

const INICIO = '2026-03-10T09:00:00.000Z';

function conReloj() {
  const clock = createTestClock(INICIO);
  const repos = repositorios();
  return { clock, ...repos };
}

async function leerBiblioteca(repository: ReturnType<typeof createMemoryRepository>): Promise<Library> {
  const result = await repository.load();
  if (result.status !== 'ok') throw new Error(`biblioteca ilegible: ${result.status}`);
  return result.library;
}

async function leerHistorial(
  repository: ReturnType<typeof createMemoryHistoryRepository>,
): Promise<StudyHistory> {
  await repository.flush();
  const result = await repository.load();
  if (result.status !== 'ok' && result.status !== 'partial') {
    throw new Error(`historial ilegible: ${result.status}`);
  }
  return result.history;
}

/** Crea un mazo con `cartas` tarjetas y deja abierto su detalle. */
async function prepararMazo(cartas: number, nombre = 'Inglés') {
  await screen.findByTestId('create-deck-button');
  await crearMazo(nombre);
  await abrirMazo('mazo-1');
  for (let index = 0; index < cartas; index += 1) {
    await anadirCarta(`frente ${index}`, `reverso ${index}`);
  }
}

async function empezarSesion() {
  await irA('study-button');
  await screen.findByTestId('study-card');
}

// ── Interfaz ─────────────────────────────────────────────────────────────────

describe('La pantalla de estudio', () => {
  it('oculta las calificaciones hasta revelar la respuesta y las muestra después', async () => {
    const entorno = conReloj();
    montarApp(entorno);
    await prepararMazo(1);
    await empezarSesion();

    expect(screen.queryByTestId('rating-buttons')).toBeNull();
    for (const testID of ['rate-again', 'rate-hard', 'rate-good', 'rate-easy']) {
      expect(screen.queryByTestId(testID)).toBeNull();
    }

    await act(async () => {
      fireEvent.press(screen.getByTestId('reveal-button'));
    });

    expect(screen.getByTestId('rating-buttons')).toBeTruthy();
    for (const testID of ['rate-again', 'rate-hard', 'rate-good', 'rate-easy']) {
      expect(screen.getByTestId(testID)).toBeTruthy();
    }
  });

  it('etiqueta los cuatro botones en español', async () => {
    const entorno = conReloj();
    montarApp(entorno);
    await prepararMazo(1);
    await empezarSesion();
    await act(async () => {
      fireEvent.press(screen.getByTestId('reveal-button'));
    });

    expect(screen.getByText('Otra vez')).toBeTruthy();
    expect(screen.getByText('Difícil')).toBeTruthy();
    expect(screen.getByText('Bien')).toBeTruthy();
    expect(screen.getByText('Fácil')).toBeTruthy();
  });

  it('cada botón anuncia el intervalo real que produce esa calificación', async () => {
    const entorno = conReloj();
    montarApp(entorno);
    await prepararMazo(1);
    await empezarSesion();
    await act(async () => {
      fireEvent.press(screen.getByTestId('reveal-button'));
    });

    // El preview del scheduler para una carta nueva en este instante exacto.
    const preview = appScheduler.preview(newScheduling, entorno.clock.now());
    const testIds = {
      'otra-vez': 'rate-again',
      dificil: 'rate-hard',
      bien: 'rate-good',
      facil: 'rate-easy',
    } as const;

    for (const rating of reviewRatings) {
      const esperado = formatSchedulingInterval(preview[rating].intervalMs);
      const etiqueta = String(
        screen.getByTestId(testIds[rating]).props.accessibilityLabel ?? '',
      );
      expect(etiqueta).toContain(`Volverá en ${esperado}`);
    }

    // Y no son literales: los cuatro son distintos entre sí.
    const intervalos = reviewRatings.map((rating) =>
      formatSchedulingInterval(preview[rating].intervalMs),
    );
    expect(new Set(intervalos).size).toBeGreaterThan(1);
  });
});

// ── Persistencia ─────────────────────────────────────────────────────────────

describe('Calificar persiste la programación', () => {
  it('guarda estado, vencimiento, estabilidad y dificultad de la tarjeta', async () => {
    const entorno = conReloj();
    montarApp(entorno);
    await prepararMazo(1);
    await empezarSesion();
    await calificar('facil');

    const library = await leerBiblioteca(entorno.libraryRepository);
    const carta = library.cards[0]!;

    const esperado = appScheduler.rate(newScheduling, 'facil', entorno.clock.now()).scheduling;
    expect(carta.scheduling.state).toBe('repaso');
    expect(carta.scheduling.due).toBe(esperado.due);
    expect(carta.scheduling.stability).toBe(esperado.stability);
    expect(carta.scheduling.difficulty).toBe(esperado.difficulty);
    expect(carta.scheduling.reps).toBe(1);
  });

  it('guarda con la biblioteca qué scheduler la programó', async () => {
    const entorno = conReloj();
    montarApp(entorno);
    await prepararMazo(1);
    await empezarSesion();
    await calificar('bien');

    const library = await leerBiblioteca(entorno.libraryRepository);

    expect(library.scheduler).not.toBeNull();
    expect(library.scheduler!.id).toBe('fsrs');
    expect(library.scheduler!.version).toContain('ts-fsrs');
    expect(library.scheduler!.parameters.requestRetention).toBe(0.9);
  });

  it('la programación sobrevive a recrear el repositorio y volver a montar la aplicación', async () => {
    const entorno = conReloj();
    montarApp(entorno);
    await prepararMazo(1);
    await empezarSesion();
    await calificar('facil');

    const guardado = await leerBiblioteca(entorno.libraryRepository);
    const antes = guardado.cards[0]!.scheduling;

    // Repositorio nuevo sobre exactamente los mismos bytes.
    const recreado = createMemoryRepository(entorno.libraryRepository.peek());
    const recuperado = await leerBiblioteca(recreado);

    expect(recuperado.cards[0]!.scheduling).toEqual(antes);
    expect(recuperado.cards[0]!.scheduling.state).toBe('repaso');
  });

  it('editar el contenido de una tarjeta no toca su programación', async () => {
    const entorno = conReloj();
    montarApp(entorno);
    await prepararMazo(1);
    await empezarSesion();
    await calificar('facil');
    const antes = (await leerBiblioteca(entorno.libraryRepository)).cards[0]!.scheduling;

    await irA('finish-back-button');
    await screen.findByTestId('add-card-button');
    await irA('edit-card-carta-2');
    fireEvent.changeText(await screen.findByTestId('edit-card-front-carta-2'), 'otro frente');
    fireEvent.changeText(screen.getByTestId('edit-card-back-carta-2'), 'otro reverso');
    await irA('save-card-carta-2');

    const despues = (await leerBiblioteca(entorno.libraryRepository)).cards[0]!;
    expect(despues.front).toBe('otro frente');
    expect(despues.scheduling).toEqual(antes);
  });
});

// ── Registro de la calificación ──────────────────────────────────────────────

describe('Calificar registra la revisión', () => {
  it('conserva estado, vencimiento e intervalo previos y nuevos, y la versión del scheduler', async () => {
    const entorno = conReloj();
    montarApp(entorno);
    await prepararMazo(1);
    await empezarSesion();
    await calificar('dificil');

    const history = await leerHistorial(entorno.historyRepository);
    expect(history.reviews).toHaveLength(1);

    const review = history.reviews[0]!;
    const esperado = appScheduler.rate(newScheduling, 'dificil', entorno.clock.now());

    expect(review.rating).toBe('dificil');
    expect(review.previousState).toBe('nueva');
    expect(review.newState).toBe(esperado.scheduling.state);
    expect(review.previousDue).toBeNull();
    expect(review.newDue).toBe(esperado.scheduling.due);
    expect(review.previousIntervalDays).toBe(0);
    expect(review.newIntervalDays).toBe(esperado.scheduling.scheduledDays);
    expect(review.stability).toBe(esperado.scheduling.stability);
    expect(review.difficulty).toBe(esperado.scheduling.difficulty);
    expect(review.schedulerId).toBe('fsrs');
    expect(review.schedulerVersion).toContain('ts-fsrs');
    expect(review.deckId).toBe('mazo-1');
    expect(review.cardId).toBe('carta-2');
    expect(review.sessionId).toBe(history.sessions[0]?.id);
  });

  it('fija la fecha desde la que hay datos de calificación, y no la mueve después', async () => {
    const entorno = conReloj();
    montarApp(entorno);
    await prepararMazo(2);
    await empezarSesion();
    await calificar('bien');
    const primera = (await leerHistorial(entorno.historyRepository)).ratedSince;

    entorno.clock.advance(60_000);
    await calificar('facil');
    const segunda = (await leerHistorial(entorno.historyRepository)).ratedSince;

    expect(primera).toBe(Date.parse(INICIO));
    expect(segunda).toBe(primera);
  });

  it('lo calificado no se cuenta además como actividad sin calificar', async () => {
    // El evento de la carta y el registro de la calificación se cierran con el mismo
    // instante. Si dejaran de hacerlo, cada tarjeta calificada aparecería a la vez en las
    // calificaciones y en el recuento de actividad sin calificar.
    const entorno = conReloj();
    montarApp(entorno);
    await prepararMazo(2);
    await empezarSesion();
    await calificar('facil');
    await calificar('bien');

    const history = await leerHistorial(entorno.historyRepository);
    const report = buildStatsReport(
      { library: await leerBiblioteca(entorno.libraryRepository), history },
      {
        scope: { kind: 'all' },
        period: 'all',
        today: localDayOf(entorno.clock.now()),
        now: entorno.clock.now(),
      },
    );

    expect(report.answerButtons.total).toBe(2);
    expect(report.answerButtons.unrated).toBe(0);
  });

  it('el registro es append-only: cada calificación añade una entrada más', async () => {
    const entorno = conReloj();
    montarApp(entorno);
    await prepararMazo(3);
    await empezarSesion();
    await calificar('facil');
    await calificar('bien');
    await calificar('otra-vez');

    const history = await leerHistorial(entorno.historyRepository);
    expect(history.reviews).toHaveLength(3);
    expect(history.reviews.map((review) => review.rating)).toEqual(['facil', 'bien', 'otra-vez']);
    expect(new Set(history.reviews.map((review) => review.id)).size).toBe(3);
  });

  it('una doble pulsación sobre la misma calificación solo escribe una vez', async () => {
    const entorno = conReloj();
    montarApp(entorno);
    await prepararMazo(2);
    await empezarSesion();

    await act(async () => {
      fireEvent.press(screen.getByTestId('reveal-button'));
    });
    // Dos pulsaciones en el mismo tick, como un doble toque real.
    await act(async () => {
      fireEvent.press(screen.getByTestId('rate-good'));
      fireEvent.press(screen.getByTestId('rate-good'));
    });

    const history = await leerHistorial(entorno.historyRepository);
    expect(history.reviews).toHaveLength(1);
    expect(history.cardEvents).toHaveLength(1);

    // Y la programación se aplicó una sola vez.
    const library = await leerBiblioteca(entorno.libraryRepository);
    expect(library.cards[0]!.scheduling.reps).toBe(1);
  });
});

// ── Cola y sesión ────────────────────────────────────────────────────────────

describe('La cola de la sesión', () => {
  it('una tarjeta calificada Otra vez vuelve a aparecer en la misma sesión', async () => {
    const entorno = conReloj();
    montarApp(entorno);
    await prepararMazo(2);
    await empezarSesion();

    expect(screen.getByText('frente 0')).toBeTruthy();
    await calificar('otra-vez');
    // Ahora toca la segunda…
    expect(screen.getByText('frente 1')).toBeTruthy();
    await calificar('facil');
    // …y la primera vuelve, porque sigue en aprendizaje.
    expect(screen.getByText('frente 0')).toBeTruthy();
  });

  it('una tarjeta que pasa a repaso no vuelve a aparecer en la sesión', async () => {
    const entorno = conReloj();
    montarApp(entorno);
    await prepararMazo(2);
    await empezarSesion();

    await calificar('facil');
    await calificar('facil');

    expect(await screen.findByTestId('study-finished')).toBeTruthy();
  });

  it('con todas las tarjetas programadas para el futuro, la sesión avisa en vez de romperse', async () => {
    const entorno = conReloj();
    montarApp(entorno);
    await prepararMazo(1);
    await empezarSesion();
    await calificar('facil');
    await screen.findByTestId('study-finished');
    await irA('finish-back-button');
    await screen.findByTestId('add-card-button');

    await empezarSesionVacia();

    expect(screen.getByTestId('study-empty')).toBeTruthy();
    expect(screen.getByText('Nada que estudiar por ahora')).toBeTruthy();
  });

  it('adelantar el reloj devuelve la tarjeta a la cola', async () => {
    const entorno = conReloj();
    montarApp(entorno);
    await prepararMazo(1);
    await empezarSesion();
    await calificar('facil');
    await screen.findByTestId('study-finished');
    await irA('finish-back-button');
    await screen.findByTestId('add-card-button');

    // Fácil sobre una carta nueva la programa a varios días: hoy no toca.
    await empezarSesionVacia();
    expect(screen.getByTestId('study-empty')).toBeTruthy();
    await irA('back-to-deck-action');
    await screen.findByTestId('add-card-button');

    entorno.clock.advanceDays(30);
    await empezarSesion();

    expect(screen.getByTestId('study-card')).toBeTruthy();
    expect(screen.getByText('frente 0')).toBeTruthy();
  });

  it('una tarjeta eliminada desaparece de la cola', async () => {
    const entorno = conReloj();
    montarApp(entorno);
    await prepararMazo(2);

    await irA('delete-card-carta-2');
    await irA('delete-confirm-confirm');
    await empezarSesion();

    expect(screen.getByText('frente 1')).toBeTruthy();
    expect(screen.queryByText('frente 0')).toBeNull();
    expect(screen.getByText('1 tarjeta por delante')).toBeTruthy();
  });

  it('terminar la sesión cierra la sesión y no toca las tarjetas sin responder', async () => {
    const entorno = conReloj();
    montarApp(entorno);
    await prepararMazo(3);
    await empezarSesion();
    await calificar('bien');

    await irA('finish-session-button');
    await screen.findByTestId('add-card-button');

    const history = await leerHistorial(entorno.historyRepository);
    expect(history.sessions).toHaveLength(1);
    expect(history.sessions[0]?.endedAt).not.toBeNull();
    expect(history.reviews).toHaveLength(1);

    const library = await leerBiblioteca(entorno.libraryRepository);
    const sinResponder = library.cards.filter((card) => card.scheduling.state === 'nueva');
    expect(sinResponder).toHaveLength(2);
    for (const card of sinResponder) {
      expect(card.scheduling).toEqual(newScheduling);
    }
  });
});

// ── Resumen del mazo ─────────────────────────────────────────────────────────

describe('El resumen del mazo', () => {
  it('muestra Nuevas, Aprendiendo y Repasar según el estado del scheduler', async () => {
    const entorno = conReloj();
    montarApp(entorno);
    await prepararMazo(3);

    expect(contador('nuevas')).toBe('3');
    expect(contador('aprendiendo')).toBe('0');
    expect(contador('repasar')).toBe('0');

    await empezarSesion();
    // Otra vez la deja aprendiendo, con vencimiento a un minuto.
    await calificar('otra-vez');
    await irA('finish-session-button');
    await screen.findByTestId('add-card-button');

    expect(contador('nuevas')).toBe('2');
    // Todavía no le toca: vence dentro de un minuto y se anuncia aparte.
    expect(contador('aprendiendo')).toBe('0');
    expect(screen.getByTestId('deck-summary-later')).toBeTruthy();

    entorno.clock.advance(120_000);
    await irA('nav-mazos');
    await abrirMazo('mazo-1');

    expect(contador('aprendiendo')).toBe('1');
  });

  it('no cuenta como Repasar una tarjeta programada para el futuro', async () => {
    const entorno = conReloj();
    montarApp(entorno);
    await prepararMazo(1);
    await empezarSesion();
    await calificar('facil');
    await irA('finish-back-button');
    await screen.findByTestId('add-card-button');

    expect(contador('repasar')).toBe('0');
    expect(contador('nuevas')).toBe('0');
  });
});

/** Valor de un contador del resumen, leído por su etiqueta accesible. */
function contador(clave: 'nuevas' | 'aprendiendo' | 'repasar'): string {
  const etiqueta = String(
    screen.getByTestId(`deck-summary-${clave}`).props.accessibilityLabel ?? '',
  );
  return etiqueta.slice(etiqueta.indexOf(':') + 1).trim();
}

/** Entra a estudiar esperando el estado vacío en vez de una tarjeta. */
async function empezarSesionVacia() {
  await irA('study-button');
  await screen.findByTestId('study-empty');
}
