import { buildStatsReport } from '../../src/features/stats/engine';
import type { StatsPeriod } from '../../src/features/stats/types';
import {
  biblioteca,
  carta,
  cartaEnRepaso,
  evento,
  historial,
  mazo,
  resetSequence,
  revision,
} from '../fixtures/stats/builders';

/**
 * Volumen.
 *
 * Lo que hay que demostrar no es que sea rápido en una máquina concreta, que dependería de
 * la máquina, sino dos cosas comprobables: que con volumen los totales siguen siendo
 * exactos, y que lo que se entrega para dibujar está agregado por día y por hora, no un
 * punto por evento. Una gráfica con 10.000 barras no la salva ninguna librería.
 */

const HOY = '2026-08-23';
const AHORA = Date.parse(`${HOY}T12:00:00Z`);
const MAZOS = ['mazo-a', 'mazo-b', 'mazo-c', 'mazo-d'];

beforeEach(resetSequence);

/** `total` eventos repartidos de forma determinista entre mazos, días y horas. */
function datasetDe(total: number, dias: number) {
  const cardEvents = Array.from({ length: total }, (_, index) => {
    const dia = index % dias;
    const day = `2026-08-23`;
    const fecha = new Date(Date.UTC(2026, 7, 23 - dia));
    const localDay = fecha.toISOString().slice(0, 10);
    return evento({
      deckId: MAZOS[index % MAZOS.length]!,
      day: localDay || day,
      hour: index % 24,
      cardId: `carta-${index % 500}`,
      activeMs: 10_000,
    });
  });

  return {
    library: biblioteca(
      MAZOS.map((id, index) => mazo(id, `Mazo ${index}`)),
      Array.from({ length: 500 }, (_, index) => carta(`carta-${index}`, MAZOS[index % 4]!)),
    ),
    history: historial({ cardEvents }),
  };
}

describe.each([1_000, 10_000])('Con %i eventos', (total) => {
  const dias = 300;
  const input = datasetDe(total, dias);

  it('los totales siguen siendo exactos', () => {
    const report = buildStatsReport(input, { scope: { kind: 'all' }, period: 'all', today: HOY, now: AHORA });

    expect(report.activity.total).toBe(total);
    // Cada evento aporta 10 s exactos.
    expect(report.time.totalMs).toBe(total * 10_000);
    expect(report.speed.averageSeconds).toBe(10);
  });

  it('la suma de los ámbitos por mazo iguala el global, sin perder ni duplicar eventos', () => {
    const global = buildStatsReport(input, { scope: { kind: 'all' }, period: 'all', today: HOY, now: AHORA });
    const suma = MAZOS.reduce(
      (acumulado, deckId) =>
        acumulado +
        buildStatsReport(input, { scope: { kind: 'deck', deckId }, period: 'all', today: HOY, now: AHORA })
          .activity.total,
      0,
    );

    expect(suma).toBe(global.activity.total);
  });

  it('la serie diaria trae como mucho un punto por día del periodo, no uno por evento', () => {
    const report = buildStatsReport(input, { scope: { kind: 'all' }, period: '1y', today: HOY, now: AHORA });

    expect(report.activity.series).toHaveLength(365);
    expect(report.time.series).toHaveLength(365);
    expect(report.calendar.days).toHaveLength(365);
    // Con 10.000 eventos, la gráfica recibe 365 barras, no 10.000.
    expect(report.activity.series.length).toBeLessThan(total);
  });

  it('la distribución horaria son siempre 24 puntos', () => {
    const report = buildStatsReport(input, { scope: { kind: 'all' }, period: 'all', today: HOY, now: AHORA });

    expect(report.hourly.hours).toHaveLength(24);
    expect(report.hourly.hours.reduce((sum, hour) => sum + hour.cards, 0)).toBe(total);
  });

  it('la comparación de mazos trae una fila por mazo, no una por evento', () => {
    const report = buildStatsReport(input, { scope: { kind: 'all' }, period: 'all', today: HOY, now: AHORA });

    expect(report.deckComparison).toHaveLength(MAZOS.length);
  });

  it.each(['1m', '3m', '1y', 'all'] as const)(
    'el informe de %s se construye dentro del presupuesto del test',
    (period: StatsPeriod) => {
      const inicio = Date.now();
      buildStatsReport(input, { scope: { kind: 'all' }, period, today: HOY, now: AHORA });
      const transcurrido = Date.now() - inicio;

      // Un umbral generoso: no mide rendimiento fino, detecta que no haya un coste
      // cuadrático escondido que con 10.000 eventos se dispararía.
      expect(transcurrido).toBeLessThan(2_000);
    },
  );
});

/**
 * Volumen con repetición espaciada.
 *
 * Mil tarjetas con programación real y diez mil calificaciones. Igual que arriba, lo que se
 * demuestra es exactitud y forma de la salida: la distribución que se entrega para dibujar
 * tiene un puñado de tramos, no una entrada por tarjeta, y Future Due tiene un punto por
 * día del horizonte, no uno por revisión.
 */
describe('Con 1.000 tarjetas programadas y 10.000 calificaciones', () => {
  const TARJETAS = 1_000;
  const REVISIONES = 10_000;

  function datasetGrande() {
    const cards = Array.from({ length: TARJETAS }, (_, index) =>
      // Intervalos y vencimientos repartidos de forma determinista por todo el año.
      cartaEnRepaso(`carta-${index}`, MAZOS[index % MAZOS.length]!, {
        intervalo: (index % 120) + 1,
        enDias: (index % 300) + 1,
        desde: AHORA,
      }),
    );

    const reviews = Array.from({ length: REVISIONES }, (_, index) => {
      const dia = index % 300;
      const fecha = new Date(Date.UTC(2026, 7, 23) - dia * 86_400_000);
      return revision({
        deckId: MAZOS[index % MAZOS.length]!,
        cardId: `carta-${index % TARJETAS}`,
        day: fecha.toISOString().slice(0, 10),
        rating: (['otra-vez', 'dificil', 'bien', 'facil'] as const)[index % 4]!,
        previousIntervalDays: (index % 40) + 1,
      });
    });

    return {
      library: biblioteca(
        MAZOS.map((id, index) => mazo(id, `Mazo ${index}`)),
        cards,
      ),
      history: historial({ ratedSince: AHORA, reviews }),
    };
  }

  const input = datasetGrande();
  const report = buildStatsReport(input, {
    scope: { kind: 'all' },
    period: 'all',
    today: HOY,
    now: AHORA,
  });

  it('cuenta las 10.000 calificaciones y las reparte entre las cuatro', () => {
    expect(report.answerButtons.total).toBe(REVISIONES);
    expect(report.answerButtons.slices.reduce((sum, slice) => sum + slice.reviews, 0)).toBe(
      REVISIONES,
    );
    for (const slice of report.answerButtons.slices) {
      expect(slice.reviews).toBe(REVISIONES / 4);
    }
  });

  it('el conteo por estado cubre las 1.000 tarjetas', () => {
    const { scheduler } = report.counts;
    expect(
      scheduler.nuevas + scheduler.aprendiendo + scheduler.reaprendiendo + scheduler.young + scheduler.mature,
    ).toBe(TARJETAS);
  });

  it('la suma de los ámbitos por mazo iguala el global también en calificaciones', () => {
    const suma = MAZOS.reduce(
      (total, deckId) =>
        total +
        buildStatsReport(input, {
          scope: { kind: 'deck', deckId },
          period: 'all',
          today: HOY,
          now: AHORA,
        }).answerButtons.total,
      0,
    );

    expect(suma).toBe(report.answerButtons.total);
  });

  it('las distribuciones se entregan agregadas por tramo, no una entrada por tarjeta', () => {
    expect(report.reviewIntervals.buckets.length).toBeLessThan(20);
    expect(report.stability.buckets.length).toBeLessThan(20);
    expect(report.difficulty.buckets).toHaveLength(9);
    expect(report.retrievability.buckets).toHaveLength(10);
    expect(report.reviewIntervals.samples).toBe(TARJETAS);
  });

  it('Future Due se entrega con un punto por día del horizonte, no uno por tarjeta', () => {
    const unMes = buildStatsReport(input, {
      scope: { kind: 'all' },
      period: '1m',
      today: HOY,
      now: AHORA,
    }).futureDue;

    expect(unMes.buckets).toHaveLength(31);
    expect(unMes.buckets.reduce((sum, bucket) => sum + bucket.reviews, 0)).toBe(unMes.total);
  });

  it('la retención agrega en seis filas, con independencia del volumen', () => {
    expect(report.trueRetention.rows).toHaveLength(6);
    expect(report.trueRetention.rows.find((row) => row.key === 'todo')!.total.total).toBeGreaterThan(
      0,
    );
  });
});
