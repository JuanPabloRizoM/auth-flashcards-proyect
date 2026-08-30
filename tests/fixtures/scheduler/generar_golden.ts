/**
 * Generador de los valores golden del scheduler.
 *
 * No se ejecuta en los tests: se ejecuta a mano cuando se sube deliberadamente la versión de
 * la implementación FSRS, y su salida se guarda en `golden.json`. Los tests comparan contra
 * ese archivo, de modo que cualquier cambio de scheduling producido por una actualización de
 * la librería aparezca como un test en rojo y no como una diferencia silenciosa.
 *
 * ```bash
 * npx tsx tests/fixtures/scheduler/generar_golden.ts > tests/fixtures/scheduler/golden.json
 * ```
 */
import { createFsrsScheduler } from '../../../src/features/scheduler/fsrsAdapter';
import { newScheduling, reviewRatings, type ReviewRating } from '../../../src/features/scheduler/types';

const scheduler = createFsrsScheduler();
const START = Date.parse('2026-01-01T10:00:00.000Z');
const SEQUENCE: ReviewRating[] = ['bien', 'bien', 'otra-vez', 'dificil', 'facil'];

let scheduling = { ...newScheduling };
let now = START;

const previews: unknown[] = [];
const steps: unknown[] = [];

for (const rating of SEQUENCE) {
  const preview = scheduler.preview(scheduling, now);
  previews.push({
    at: new Date(now).toISOString(),
    intervals: Object.fromEntries(
      reviewRatings.map((candidate) => [candidate, preview[candidate].intervalMs]),
    ),
  });

  const outcome = scheduler.rate(scheduling, rating, now);
  scheduling = outcome.scheduling;
  steps.push({
    at: new Date(now).toISOString(),
    rating,
    intervalMs: outcome.intervalMs,
    scheduling: { ...scheduling, dueIso: new Date(scheduling.due!).toISOString() },
  });
  now = scheduling.due!;
}

process.stdout.write(
  `${JSON.stringify(
    {
      scheduler: { id: scheduler.id, version: scheduler.version },
      parameters: scheduler.parameters,
      requestRetention: scheduler.parameters.requestRetention,
      generatedFor: new Date(START).toISOString(),
      sequence: SEQUENCE,
      previews,
      steps,
    },
    null,
    2,
  )}\n`,
);
