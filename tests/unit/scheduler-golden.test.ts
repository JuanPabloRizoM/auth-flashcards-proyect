import { createFsrsScheduler } from '../../src/features/scheduler/fsrsAdapter';
import {
  newScheduling,
  reviewRatings,
  type CardScheduling,
  type ReviewRating,
} from '../../src/features/scheduler/types';
import golden from '../fixtures/scheduler/golden.json';

/**
 * Tests golden del scheduler.
 *
 * No comprueban que "existe un vencimiento" ni que "el intervalo es mayor que cero": eso lo
 * cumpliría cualquier algoritmo inventado. Comprueban que **estos** valores concretos son
 * los que produce la implementación FSRS con **estos** parámetros.
 *
 * La secuencia recorre los cuatro estados y las cuatro calificaciones:
 *
 * ```text
 * T0            Nueva          → Bien      → Aprendiendo
 * due anterior  Aprendiendo    → Bien      → Repaso
 * due anterior  Repaso         → Otra vez  → Reaprendiendo
 * due anterior  Reaprendiendo  → Difícil   → Reaprendiendo
 * due anterior  Reaprendiendo  → Fácil     → Repaso
 * ```
 *
 * El fixture registra la versión de la librería, los parámetros, la retención objetivo, la
 * fecha de partida, las calificaciones y los resultados esperados. Si mañana se sube la
 * versión de FSRS y el scheduling cambia, estos tests se ponen en rojo y la diferencia se
 * ve; sin ellos, los intervalos de todo el mundo cambiarían en silencio.
 *
 * Para regenerarlo, a propósito y tras revisar el cambio:
 * `npx tsx tests/fixtures/scheduler/generar_golden.ts > tests/fixtures/scheduler/golden.json`
 */

const scheduler = createFsrsScheduler();

describe('el fixture describe el scheduler que está en uso', () => {
  it('coincide la identidad y la versión', () => {
    expect(golden.scheduler.id).toBe(scheduler.id);
    expect(golden.scheduler.version).toBe(scheduler.version);
  });

  it('coincide la retención objetivo', () => {
    expect(golden.requestRetention).toBe(0.9);
    expect(golden.requestRetention).toBe(scheduler.parameters.requestRetention);
  });

  it('coinciden los parámetros, pesos incluidos', () => {
    expect(golden.parameters).toEqual(scheduler.parameters);
  });

  it('el fixture registra todo lo necesario para reproducirlo', () => {
    expect(golden.generatedFor).toBe('2026-01-01T10:00:00.000Z');
    expect(golden.sequence).toEqual(['bien', 'bien', 'otra-vez', 'dificil', 'facil']);
    expect(golden.steps).toHaveLength(golden.sequence.length);
    expect(golden.previews).toHaveLength(golden.sequence.length);
  });
});

describe('secuencia determinista de calificaciones', () => {
  /** Reproduce la secuencia entera avanzando el reloj hasta el vencimiento de cada paso. */
  function reproducir() {
    let scheduling: CardScheduling = { ...newScheduling };
    let now = Date.parse(golden.generatedFor);
    const pasos: { at: number; scheduling: CardScheduling; intervalMs: number }[] = [];

    for (const rating of golden.sequence as ReviewRating[]) {
      const outcome = scheduler.rate(scheduling, rating, now);
      pasos.push({ at: now, scheduling: outcome.scheduling, intervalMs: outcome.intervalMs });
      scheduling = outcome.scheduling;
      now = scheduling.due!;
    }
    return pasos;
  }

  const pasos = reproducir();

  golden.steps.forEach((esperado, index) => {
    describe(`paso ${index + 1}: ${esperado.rating} en ${esperado.at}`, () => {
      const real = pasos[index]!;

      it('se califica en el instante esperado', () => {
        expect(new Date(real.at).toISOString()).toBe(esperado.at);
      });

      it('produce el estado esperado', () => {
        expect(real.scheduling.state).toBe(esperado.scheduling.state);
      });

      it('produce el vencimiento exacto esperado', () => {
        expect(new Date(real.scheduling.due!).toISOString()).toBe(esperado.scheduling.dueIso);
        expect(real.intervalMs).toBe(esperado.intervalMs);
      });

      it('produce la estabilidad y la dificultad esperadas', () => {
        expect(real.scheduling.stability).toBeCloseTo(esperado.scheduling.stability, 8);
        expect(real.scheduling.difficulty).toBeCloseTo(esperado.scheduling.difficulty, 8);
      });

      it('produce los contadores esperados', () => {
        expect(real.scheduling.reps).toBe(esperado.scheduling.reps);
        expect(real.scheduling.lapses).toBe(esperado.scheduling.lapses);
        expect(real.scheduling.scheduledDays).toBe(esperado.scheduling.scheduledDays);
        expect(real.scheduling.elapsedDays).toBe(esperado.scheduling.elapsedDays);
        expect(real.scheduling.learningSteps).toBe(esperado.scheduling.learningSteps);
      });
    });
  });

  it('la secuencia recorre los cuatro estados', () => {
    const estados = new Set(['nueva', ...pasos.map((paso) => paso.scheduling.state)]);
    expect([...estados].sort()).toEqual(['aprendiendo', 'nueva', 'reaprendiendo', 'repaso']);
  });

  it('la secuencia usa las cuatro calificaciones', () => {
    expect(new Set(golden.sequence).size).toBe(4);
  });
});

describe('los cuatro intervalos del preview coinciden con el fixture', () => {
  it('en cada paso de la secuencia', () => {
    let scheduling: CardScheduling = { ...newScheduling };
    let now = Date.parse(golden.generatedFor);

    golden.previews.forEach((esperado, index) => {
      expect(new Date(now).toISOString()).toBe(esperado.at);
      const preview = scheduler.preview(scheduling, now);

      for (const rating of reviewRatings) {
        expect(preview[rating].intervalMs).toBe(
          (esperado.intervals as Record<string, number>)[rating],
        );
      }

      const outcome = scheduler.rate(scheduling, golden.sequence[index] as ReviewRating, now);
      scheduling = outcome.scheduling;
      now = scheduling.due!;
    });
  });
});
