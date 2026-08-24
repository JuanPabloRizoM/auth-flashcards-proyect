import { buildStatsReport } from '../../src/features/stats/engine';
import type { StatsPeriod } from '../../src/features/stats/types';
import { biblioteca, carta, evento, historial, mazo, resetSequence } from '../fixtures/stats/builders';

/**
 * Volumen.
 *
 * Lo que hay que demostrar no es que sea rápido en una máquina concreta, que dependería de
 * la máquina, sino dos cosas comprobables: que con volumen los totales siguen siendo
 * exactos, y que lo que se entrega para dibujar está agregado por día y por hora, no un
 * punto por evento. Una gráfica con 10.000 barras no la salva ninguna librería.
 */

const HOY = '2026-08-23';
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
    const report = buildStatsReport(input, { scope: { kind: 'all' }, period: 'all', today: HOY });

    expect(report.activity.total).toBe(total);
    // Cada evento aporta 10 s exactos.
    expect(report.time.totalMs).toBe(total * 10_000);
    expect(report.speed.averageSeconds).toBe(10);
  });

  it('la suma de los ámbitos por mazo iguala el global, sin perder ni duplicar eventos', () => {
    const global = buildStatsReport(input, { scope: { kind: 'all' }, period: 'all', today: HOY });
    const suma = MAZOS.reduce(
      (acumulado, deckId) =>
        acumulado +
        buildStatsReport(input, { scope: { kind: 'deck', deckId }, period: 'all', today: HOY })
          .activity.total,
      0,
    );

    expect(suma).toBe(global.activity.total);
  });

  it('la serie diaria trae como mucho un punto por día del periodo, no uno por evento', () => {
    const report = buildStatsReport(input, { scope: { kind: 'all' }, period: '1y', today: HOY });

    expect(report.activity.series).toHaveLength(365);
    expect(report.time.series).toHaveLength(365);
    expect(report.calendar.days).toHaveLength(365);
    // Con 10.000 eventos, la gráfica recibe 365 barras, no 10.000.
    expect(report.activity.series.length).toBeLessThan(total);
  });

  it('la distribución horaria son siempre 24 puntos', () => {
    const report = buildStatsReport(input, { scope: { kind: 'all' }, period: 'all', today: HOY });

    expect(report.hourly.hours).toHaveLength(24);
    expect(report.hourly.hours.reduce((sum, hour) => sum + hour.cards, 0)).toBe(total);
  });

  it('la comparación de mazos trae una fila por mazo, no una por evento', () => {
    const report = buildStatsReport(input, { scope: { kind: 'all' }, period: 'all', today: HOY });

    expect(report.deckComparison).toHaveLength(MAZOS.length);
  });

  it.each(['1m', '3m', '1y', 'all'] as const)(
    'el informe de %s se construye dentro del presupuesto del test',
    (period: StatsPeriod) => {
      const inicio = Date.now();
      buildStatsReport(input, { scope: { kind: 'all' }, period, today: HOY });
      const transcurrido = Date.now() - inicio;

      // Un umbral generoso: no mide rendimiento fino, detecta que no haya un coste
      // cuadrático escondido que con 10.000 eventos se dispararía.
      expect(transcurrido).toBeLessThan(2_000);
    },
  );
});
