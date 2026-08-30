import {
  createFsrsScheduler,
  FSRS_SCHEDULER_ID,
  FSRS_SCHEDULER_VERSION,
  fsrsEmptyCardAt,
  initialScheduling,
  REQUEST_RETENTION,
} from '../../src/features/scheduler/fsrsAdapter';
import { formatSchedulingInterval } from '../../src/features/scheduler/format';
import {
  newScheduling,
  reviewRatings,
  type CardScheduling,
  type ReviewRating,
} from '../../src/features/scheduler/types';

/**
 * La abstracción del scheduler sobre FSRS.
 *
 * Aquí se comprueba el contrato propio: los cuatro estados, las cuatro transiciones, los
 * contadores, que el preview no toca la carta y que la retrievability se mueve con el
 * tiempo. Los valores concretos que produce el algoritmo se comparan contra los fixtures
 * golden en `scheduler-golden.test.ts`; lo de aquí es el comportamiento, no las cifras.
 */

const scheduler = createFsrsScheduler();
const T0 = Date.parse('2026-01-01T10:00:00.000Z');
const DAY = 86_400_000;

/** Lleva una carta hasta el estado de repaso por el camino más corto y determinista. */
function hastaRepaso(): { scheduling: CardScheduling; at: number } {
  const outcome = scheduler.rate(newScheduling, 'facil', T0);
  expect(outcome.scheduling.state).toBe('repaso');
  return { scheduling: outcome.scheduling, at: T0 };
}

describe('identidad y parámetros', () => {
  it('declara el algoritmo, su versión y la retención objetivo confirmada', () => {
    expect(scheduler.id).toBe(FSRS_SCHEDULER_ID);
    expect(scheduler.id).toBe('fsrs');
    expect(scheduler.version).toBe(FSRS_SCHEDULER_VERSION);
    expect(scheduler.version).toContain('FSRS');
    expect(REQUEST_RETENTION).toBe(0.9);
    expect(scheduler.parameters.requestRetention).toBe(0.9);
  });

  it('no usa fuzz, para que el preview y la calificación no puedan discrepar', () => {
    expect(scheduler.parameters.enableFuzz).toBe(false);
  });

  it('expone los parámetros con los que trabaja, para poder auditarlos y migrarlos', () => {
    expect(scheduler.parameters.weights.length).toBeGreaterThan(0);
    expect(scheduler.parameters.weights.every(Number.isFinite)).toBe(true);
    expect(scheduler.parameters.learningSteps.length).toBeGreaterThan(0);
    expect(scheduler.parameters.maximumIntervalDays).toBeGreaterThan(0);
  });
});

describe('estado inicial', () => {
  it('una carta nueva no tiene vencimiento, ni estabilidad, ni repeticiones', () => {
    expect(initialScheduling()).toEqual({
      state: 'nueva',
      due: null,
      lastReview: null,
      stability: 0,
      difficulty: 0,
      elapsedDays: 0,
      scheduledDays: 0,
      learningSteps: 0,
      reps: 0,
      lapses: 0,
    });
  });

  it('coincide con lo que la propia librería considera una carta vacía', () => {
    // Si una versión futura de FSRS cambiara la representación de una carta nueva, este
    // test lo enseñaría en vez de dejar que se descubriera en producción.
    const deLaLibreria = fsrsEmptyCardAt(T0);
    expect(deLaLibreria.state).toBe('nueva');
    expect(deLaLibreria.stability).toBe(0);
    expect(deLaLibreria.difficulty).toBe(0);
    expect(deLaLibreria.reps).toBe(0);
    expect(deLaLibreria.lapses).toBe(0);
  });

  it('una carta nueva está siempre disponible', () => {
    expect(scheduler.isDue(newScheduling, T0)).toBe(true);
    expect(scheduler.isDue(newScheduling, T0 - 10 * DAY)).toBe(true);
  });
});

describe('transiciones de estado', () => {
  it('Nueva pasa a Aprendiendo con Otra vez, Difícil y Bien', () => {
    for (const rating of ['otra-vez', 'dificil', 'bien'] as ReviewRating[]) {
      const outcome = scheduler.rate(newScheduling, rating, T0);
      expect(outcome.scheduling.state).toBe('aprendiendo');
      // Los pasos de aprendizaje se miden en minutos, no en días.
      expect(outcome.intervalMs).toBeLessThan(DAY);
      expect(outcome.intervalMs).toBeGreaterThan(0);
    }
  });

  it('Nueva pasa directamente a Repaso con Fácil, con vencimiento en días', () => {
    const outcome = scheduler.rate(newScheduling, 'facil', T0);

    expect(outcome.scheduling.state).toBe('repaso');
    expect(outcome.scheduling.scheduledDays).toBeGreaterThanOrEqual(1);
    expect(outcome.intervalMs).toBeGreaterThanOrEqual(DAY);
  });

  it('Aprendiendo llega a Repaso graduando con Bien', () => {
    const primera = scheduler.rate(newScheduling, 'bien', T0);
    const segunda = scheduler.rate(primera.scheduling, 'bien', primera.scheduling.due!);

    expect(primera.scheduling.state).toBe('aprendiendo');
    expect(segunda.scheduling.state).toBe('repaso');
    expect(segunda.scheduling.scheduledDays).toBeGreaterThanOrEqual(1);
  });

  it('Repaso pasa a Reaprendiendo al fallar, y suma un lapso', () => {
    const { scheduling, at } = hastaRepaso();
    const fallo = scheduler.rate(scheduling, 'otra-vez', at + 2 * DAY);

    expect(fallo.scheduling.state).toBe('reaprendiendo');
    expect(fallo.scheduling.lapses).toBe(scheduling.lapses + 1);
    expect(fallo.intervalMs).toBeLessThan(DAY);
  });

  it('Reaprendiendo vuelve a Repaso al acertar', () => {
    const { scheduling, at } = hastaRepaso();
    const fallo = scheduler.rate(scheduling, 'otra-vez', at + 2 * DAY);
    const recuperada = scheduler.rate(fallo.scheduling, 'bien', fallo.scheduling.due!);

    expect(recuperada.scheduling.state).toBe('repaso');
  });
});

describe('contadores y valores', () => {
  it('las repeticiones suben con cada calificación', () => {
    let scheduling = { ...newScheduling };
    const vistos: number[] = [];
    for (const rating of ['bien', 'bien', 'bien'] as ReviewRating[]) {
      scheduling = scheduler.rate(scheduling, rating, scheduling.due ?? T0).scheduling;
      vistos.push(scheduling.reps);
    }

    expect(vistos).toEqual([1, 2, 3]);
  });

  it('los lapsos solo suben al fallar una carta ya aprendida', () => {
    const { scheduling, at } = hastaRepaso();
    expect(scheduling.lapses).toBe(0);

    const dificil = scheduler.rate(scheduling, 'dificil', at + 2 * DAY);
    expect(dificil.scheduling.lapses).toBe(0);

    const bien = scheduler.rate(scheduling, 'bien', at + 2 * DAY);
    expect(bien.scheduling.lapses).toBe(0);

    const facil = scheduler.rate(scheduling, 'facil', at + 2 * DAY);
    expect(facil.scheduling.lapses).toBe(0);

    const fallo = scheduler.rate(scheduling, 'otra-vez', at + 2 * DAY);
    expect(fallo.scheduling.lapses).toBe(1);
  });

  it('la estabilidad y la dificultad son números reales dentro de sus rangos', () => {
    const { scheduling } = hastaRepaso();

    expect(scheduling.stability).toBeGreaterThan(0);
    expect(Number.isFinite(scheduling.stability)).toBe(true);
    expect(scheduling.difficulty).toBeGreaterThanOrEqual(1);
    expect(scheduling.difficulty).toBeLessThanOrEqual(10);
  });

  it('la última revisión queda registrada en el instante en que se calificó', () => {
    const outcome = scheduler.rate(newScheduling, 'bien', T0);
    expect(outcome.scheduling.lastReview).toBe(T0);
  });
});

describe('preview', () => {
  it('ofrece las cuatro calificaciones con su intervalo', () => {
    const preview = scheduler.preview(newScheduling, T0);

    for (const rating of reviewRatings) {
      expect(preview[rating].rating).toBe(rating);
      expect(preview[rating].intervalMs).toBeGreaterThan(0);
      expect(preview[rating].scheduling.due).not.toBeNull();
    }
  });

  it('los cuatro intervalos van de menor a mayor', () => {
    const preview = scheduler.preview(newScheduling, T0);
    const intervalos = reviewRatings.map((rating) => preview[rating].intervalMs);

    expect(intervalos).toEqual([...intervalos].sort((a, b) => a - b));
  });

  it('no modifica la carta que recibe', () => {
    const scheduling: CardScheduling = { ...newScheduling };
    const copia = JSON.parse(JSON.stringify(scheduling));

    scheduler.preview(scheduling, T0);

    expect(scheduling).toEqual(copia);
  });

  it('calificar produce exactamente lo mismo que el preview de esa calificación', () => {
    // Sin fuzz y con el mismo instante, no hay margen para que difieran. Es lo que hace que
    // el intervalo escrito en el botón sea una promesa y no una estimación.
    const { scheduling, at } = hastaRepaso();
    const now = at + 3 * DAY;
    const preview = scheduler.preview(scheduling, now);

    for (const rating of reviewRatings) {
      expect(scheduler.rate(scheduling, rating, now)).toEqual(preview[rating]);
    }
  });
});

describe('retrievability', () => {
  it('una carta sin historial no tiene probabilidad de recuerdo, y no se inventa un cero', () => {
    expect(scheduler.getRetrievability(newScheduling, T0)).toBeNull();
  });

  it('en el momento del vencimiento ronda la retención objetivo', () => {
    const { scheduling } = hastaRepaso();
    const enVencimiento = scheduler.getRetrievability(scheduling, scheduling.due!)!;

    expect(enVencimiento).toBeGreaterThan(0.85);
    expect(enVencimiento).toBeLessThanOrEqual(1);
  });

  it('baja a medida que avanza el reloj', () => {
    const { scheduling } = hastaRepaso();
    const enVencimiento = scheduler.getRetrievability(scheduling, scheduling.due!)!;
    const unMesDespues = scheduler.getRetrievability(scheduling, scheduling.due! + 30 * DAY)!;

    expect(unMesDespues).toBeLessThan(enVencimiento);
    expect(unMesDespues).toBeGreaterThanOrEqual(0);
  });
});

describe('isDue', () => {
  it('una carta programada para el futuro no está disponible, y sí lo está al llegar su turno', () => {
    const { scheduling } = hastaRepaso();

    expect(scheduler.isDue(scheduling, scheduling.due! - 1)).toBe(false);
    expect(scheduler.isDue(scheduling, scheduling.due!)).toBe(true);
    expect(scheduler.isDue(scheduling, scheduling.due! + DAY)).toBe(true);
  });
});

describe('formatSchedulingInterval', () => {
  it('elige la unidad según la magnitud', () => {
    expect(formatSchedulingInterval(30_000)).toBe('<1 min');
    expect(formatSchedulingInterval(60_000)).toBe('1 min');
    expect(formatSchedulingInterval(6 * 60_000)).toBe('6 min');
    expect(formatSchedulingInterval(3 * 3_600_000)).toBe('3 h');
    expect(formatSchedulingInterval(DAY)).toBe('1 día');
    expect(formatSchedulingInterval(5 * DAY)).toBe('5 días');
    expect(formatSchedulingInterval(45 * DAY)).toBe('1,5 meses');
    expect(formatSchedulingInterval(730 * DAY)).toBe('2 años');
  });

  it('un intervalo imposible se rinde como desconocido, no como cero', () => {
    expect(formatSchedulingInterval(-1)).toBe('—');
    expect(formatSchedulingInterval(Number.NaN)).toBe('—');
  });
});
