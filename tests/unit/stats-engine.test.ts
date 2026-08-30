import { buildStatsReport } from '../../src/features/stats/engine';
import type { StatsQuery } from '../../src/features/stats/types';
import {
  alta,
  biblioteca,
  carta,
  evento,
  eventos,
  historial,
  mazo,
  resetSequence,
  sesion,
  snapshot,
} from '../fixtures/stats/builders';

/**
 * Motor de estadísticas.
 *
 * Los datasets son pequeños y los resultados esperados están calculados a mano en el
 * comentario de cada bloque. Un test que solo comprobara "no lanzó excepción" no
 * demostraría nada sobre las fórmulas (docs/TESTING.md).
 */

const HOY = '2026-08-23';
const AHORA = Date.parse(`${HOY}T12:00:00Z`);
const DIA_1 = '2026-08-20';
const DIA_2 = '2026-08-21';

beforeEach(resetSequence);

function consulta(partes: Partial<StatsQuery> = {}): StatsQuery {
  return { scope: { kind: 'all' }, period: 'all', today: HOY, now: AHORA, ...partes };
}

/**
 * El dataset del enunciado.
 *
 * ```text
 * Mazo A: día 1 → 10 tarjetas, día 2 → 20 tarjetas
 * Mazo B: día 1 →  5 tarjetas
 * ```
 *
 * De donde salen, sin ambigüedad:
 *
 * ```text
 * Global:   día 1 → 15, día 2 → 20, total 35
 * Filtro A: día 1 → 10, día 2 → 20, total 30
 * Filtro B: día 1 →  5,             total  5
 * ```
 */
function datasetDelEnunciado() {
  const cardEvents = [
    ...eventos(10, { deckId: 'mazo-a', day: DIA_1 }),
    ...eventos(20, { deckId: 'mazo-a', day: DIA_2 }),
    ...eventos(5, { deckId: 'mazo-b', day: DIA_1 }),
  ];
  return {
    library: biblioteca([mazo('mazo-a', 'Inglés'), mazo('mazo-b', 'Matemáticas')]),
    history: historial({ cardEvents }),
  };
}

function serieDe(report: { activity: { series: { day: string; value: number }[] } }, day: string) {
  return report.activity.series.find((point) => point.day === day)?.value;
}

describe('Ámbito: todos los mazos frente a un mazo concreto', () => {
  it('el ámbito global agrega la actividad de los dos mazos día a día', () => {
    const report = buildStatsReport(datasetDelEnunciado(), consulta());

    expect(serieDe(report, DIA_1)).toBe(15);
    expect(serieDe(report, DIA_2)).toBe(20);
    expect(report.activity.total).toBe(35);
  });

  it('el ámbito del mazo A contiene exactamente la actividad de A', () => {
    const report = buildStatsReport(
      datasetDelEnunciado(),
      consulta({ scope: { kind: 'deck', deckId: 'mazo-a' } }),
    );

    expect(serieDe(report, DIA_1)).toBe(10);
    expect(serieDe(report, DIA_2)).toBe(20);
    expect(report.activity.total).toBe(30);
  });

  it('el ámbito del mazo B contiene exactamente la actividad de B', () => {
    const report = buildStatsReport(
      datasetDelEnunciado(),
      consulta({ scope: { kind: 'deck', deckId: 'mazo-b' } }),
    );

    expect(serieDe(report, DIA_1)).toBe(5);
    expect(report.activity.total).toBe(5);
  });

  it('no hay leakage: el día 2 es exclusivo de A y no aparece en el ámbito de B', () => {
    const report = buildStatsReport(
      datasetDelEnunciado(),
      consulta({ scope: { kind: 'deck', deckId: 'mazo-b' } }),
    );

    expect(serieDe(report, DIA_2)).toBe(0);
    expect(report.activity.daysStudied).toBe(1);
    expect(report.hourly.total).toBe(5);
    expect(report.calendar.maxCards).toBe(5);
    // La suma de todas las series del ámbito de B es exactamente lo que hizo B.
    const totalCalendario = report.calendar.days.reduce((sum, day) => sum + day.cards, 0);
    expect(totalCalendario).toBe(5);
  });

  it('la suma de los dos ámbitos por mazo iguala el ámbito global', () => {
    const input = datasetDelEnunciado();
    const a = buildStatsReport(input, consulta({ scope: { kind: 'deck', deckId: 'mazo-a' } }));
    const b = buildStatsReport(input, consulta({ scope: { kind: 'deck', deckId: 'mazo-b' } }));
    const global = buildStatsReport(input, consulta());

    expect(a.activity.total + b.activity.total).toBe(global.activity.total);
    expect(a.time.totalMs + b.time.totalMs).toBe(global.time.totalMs);
  });
});

describe('Hoy', () => {
  /**
   * 4 eventos hoy en dos mazos, 3 de ellos sobre dos cartas distintas y uno repetido:
   *
   * ```text
   * carta-x  30 s   mazo-a
   * carta-x  30 s   mazo-a   (repaso repetido de la misma carta)
   * carta-y  60 s   mazo-a
   * carta-z  30 s   mazo-b
   * ```
   *
   * estudiadas 4, únicas 3, tiempo 150 s, 150/4 = 37.5 s por tarjeta, 2 mazos.
   */
  function datasetDeHoy() {
    const cardEvents = [
      evento({ deckId: 'mazo-a', day: HOY, cardId: 'carta-x', hour: 8 }),
      evento({ deckId: 'mazo-a', day: HOY, cardId: 'carta-x', hour: 9 }),
      evento({ deckId: 'mazo-a', day: HOY, cardId: 'carta-y', hour: 9, activeMs: 60_000 }),
      evento({ deckId: 'mazo-b', day: HOY, cardId: 'carta-z', hour: 20 }),
    ];
    return {
      library: biblioteca(
        [mazo('mazo-a', 'Inglés'), mazo('mazo-b', 'Matemáticas')],
        [carta('carta-x', 'mazo-a'), carta('carta-y', 'mazo-a'), carta('carta-z', 'mazo-b')],
      ),
      history: historial({
        cardEvents,
        sessions: [
          sesion({ deckId: 'mazo-a', day: HOY, id: 's-a' }),
          sesion({ deckId: 'mazo-b', day: HOY, id: 's-b' }),
        ],
      }),
    };
  }

  it('cuenta estudiadas, únicas, tiempo, segundos por tarjeta y sesiones', () => {
    const { todayStats } = buildStatsReport(datasetDeHoy(), consulta());

    expect(todayStats.studied).toBe(4);
    expect(todayStats.unique).toBe(3);
    expect(todayStats.activeMs).toBe(150_000);
    expect(todayStats.secondsPerCard).toBe(37.5);
    expect(todayStats.sessions).toBe(2);
  });

  it('cuenta los mazos estudiados solo en ámbito global', () => {
    const input = datasetDeHoy();

    expect(buildStatsReport(input, consulta()).todayStats.decksStudied).toBe(2);
    expect(
      buildStatsReport(input, consulta({ scope: { kind: 'deck', deckId: 'mazo-a' } })).todayStats
        .decksStudied,
    ).toBeNull();
  });

  it('no cuenta como estudiada una carta que se mostró pero se abandonó', () => {
    const input = {
      library: biblioteca([mazo('mazo-a', 'Inglés')]),
      history: historial({
        cardEvents: [
          evento({ deckId: 'mazo-a', day: HOY }),
          evento({ deckId: 'mazo-a', day: HOY, incompleto: true }),
        ],
      }),
    };

    expect(buildStatsReport(input, consulta()).todayStats.studied).toBe(1);
  });
});

describe('Calendario', () => {
  it('cada día lleva sus tarjetas, su tiempo y sus sesiones', () => {
    const input = {
      library: biblioteca([mazo('mazo-a', 'Inglés')]),
      history: historial({
        // 42 tarjetas de 30 s = 1.260 s = 21 min, en 2 sesiones.
        cardEvents: eventos(42, { deckId: 'mazo-a', day: DIA_1 }),
        sessions: [
          sesion({ deckId: 'mazo-a', day: DIA_1, id: 's-1' }),
          sesion({ deckId: 'mazo-a', day: DIA_1, id: 's-2' }),
        ],
      }),
    };

    const report = buildStatsReport(input, consulta());
    const dia = report.calendar.days.find((day) => day.day === DIA_1);

    expect(dia).toEqual({ day: DIA_1, cards: 42, activeMs: 1_260_000, sessions: 2, level: 4 });
  });

  it('la intensidad reparte cuatro tramos proporcionales al día más activo', () => {
    const input = {
      library: biblioteca([mazo('mazo-a', 'Inglés')]),
      history: historial({
        cardEvents: [
          ...eventos(100, { deckId: 'mazo-a', day: '2026-08-19' }),
          ...eventos(75, { deckId: 'mazo-a', day: '2026-08-20' }),
          ...eventos(50, { deckId: 'mazo-a', day: '2026-08-21' }),
          ...eventos(25, { deckId: 'mazo-a', day: '2026-08-22' }),
        ],
      }),
    };

    const niveles = new Map(
      buildStatsReport(input, consulta()).calendar.days.map((day) => [day.day, day.level]),
    );

    // 100/100 → 4, 75/100 → 3, 50/100 → 2, 25/100 → 1, y un día sin nada → 0.
    expect(niveles.get('2026-08-19')).toBe(4);
    expect(niveles.get('2026-08-20')).toBe(3);
    expect(niveles.get('2026-08-21')).toBe(2);
    expect(niveles.get('2026-08-22')).toBe(1);
    expect(niveles.get(HOY)).toBe(0);
  });

  it('el calendario respeta el filtro por mazo', () => {
    const report = buildStatsReport(
      datasetDelEnunciado(),
      consulta({ scope: { kind: 'deck', deckId: 'mazo-a' } }),
    );

    expect(report.calendar.days.find((day) => day.day === DIA_1)?.cards).toBe(10);
    expect(report.calendar.maxCards).toBe(20);
  });
});

describe('Actividad', () => {
  it('promedia sobre el periodo y sobre los días estudiados con divisores distintos', () => {
    // 35 tarjetas en 2 días de actividad, en una ventana de 30 días:
    // 35/30 = 1.1666… → 1.2 ; 35/2 = 17.5
    const report = buildStatsReport(datasetDelEnunciado(), consulta({ period: '1m' }));

    expect(report.activity.total).toBe(35);
    expect(report.activity.daysStudied).toBe(2);
    expect(report.activity.daysInPeriod).toBe(30);
    expect(report.activity.averageOverPeriod).toBe(1.2);
    expect(report.activity.averageForDaysStudied).toBe(17.5);
  });

  it('cuenta las tarjetas únicas del periodo aparte del total de repasos', () => {
    const input = {
      library: biblioteca([mazo('mazo-a', 'Inglés')]),
      history: historial({
        cardEvents: [
          evento({ deckId: 'mazo-a', day: DIA_1, cardId: 'carta-x' }),
          evento({ deckId: 'mazo-a', day: DIA_2, cardId: 'carta-x' }),
          evento({ deckId: 'mazo-a', day: DIA_2, cardId: 'carta-y' }),
        ],
      }),
    };

    const { activity } = buildStatsReport(input, consulta());
    expect(activity.total).toBe(3);
    expect(activity.uniqueCards).toBe(2);
  });
});

describe('Conteo de tarjetas', () => {
  it('separa nunca estudiadas de estudiadas al menos una vez, y suman el total', () => {
    const input = {
      library: biblioteca(
        [mazo('mazo-a', 'Inglés')],
        [carta('c-1', 'mazo-a'), carta('c-2', 'mazo-a'), carta('c-3', 'mazo-a')],
      ),
      history: historial({
        cardEvents: [
          evento({ deckId: 'mazo-a', day: DIA_1, cardId: 'c-1' }),
          evento({ deckId: 'mazo-a', day: HOY, cardId: 'c-2' }),
        ],
      }),
    };

    const { counts } = buildStatsReport(input, consulta());
    expect(counts.total).toBe(3);
    expect(counts.studiedAtLeastOnce).toBe(2);
    expect(counts.neverStudied).toBe(1);
    expect(counts.studiedAtLeastOnce + counts.neverStudied).toBe(counts.total);
    expect(counts.studiedToday).toBe(1);
  });

  it('el conteo respeta el filtro por mazo', () => {
    const input = {
      library: biblioteca(
        [mazo('mazo-a', 'Inglés'), mazo('mazo-b', 'Matemáticas')],
        [carta('c-1', 'mazo-a'), carta('c-2', 'mazo-b'), carta('c-3', 'mazo-b')],
      ),
      history: historial(),
    };

    const report = buildStatsReport(input, consulta({ scope: { kind: 'deck', deckId: 'mazo-b' } }));
    expect(report.counts.total).toBe(2);
  });

  it('no depende del periodo: una carta estudiada hace un año no vuelve a ser nueva', () => {
    const input = {
      library: biblioteca([mazo('mazo-a', 'Inglés')], [carta('c-1', 'mazo-a')]),
      history: historial({
        cardEvents: [evento({ deckId: 'mazo-a', day: '2024-01-15', cardId: 'c-1' })],
      }),
    };

    expect(buildStatsReport(input, consulta({ period: '1m' })).counts.neverStudied).toBe(0);
  });
});

describe('Tiempo', () => {
  it('suma el total, promedia por día activo y describe las sesiones cerradas', () => {
    const input = {
      library: biblioteca([mazo('mazo-a', 'Inglés')]),
      history: historial({
        // 4 tarjetas de 30 s el día 1 y 2 el día 2 → 120 s + 60 s = 180 s en 2 días.
        cardEvents: [
          ...eventos(4, { deckId: 'mazo-a', day: DIA_1 }),
          ...eventos(2, { deckId: 'mazo-a', day: DIA_2 }),
        ],
        sessions: [
          sesion({ deckId: 'mazo-a', day: DIA_1, id: 's-1', activeMs: 120_000 }),
          sesion({ deckId: 'mazo-a', day: DIA_2, id: 's-2', activeMs: 60_000 }),
          sesion({ deckId: 'mazo-a', day: HOY, id: 's-3', activeMs: 999_999, abierta: true }),
        ],
      }),
    };

    const { time } = buildStatsReport(input, consulta());

    expect(time.totalMs).toBe(180_000);
    expect(time.averagePerActiveDayMs).toBe(90_000);
    // La sesión abierta se cuenta como sesión, pero no entra en la media ni en la más larga.
    expect(time.sessions).toBe(3);
    expect(time.averageSessionMs).toBe(90_000);
    expect(time.longestSessionMs).toBe(120_000);
  });

  it('sin sesiones cerradas, la media y la más larga son desconocidas, no cero', () => {
    const input = {
      library: biblioteca([mazo('mazo-a', 'Inglés')]),
      history: historial({
        sessions: [sesion({ deckId: 'mazo-a', day: HOY, abierta: true })],
      }),
    };

    const { time } = buildStatsReport(input, consulta());
    expect(time.averageSessionMs).toBeNull();
    expect(time.longestSessionMs).toBeNull();
  });
});

describe('Velocidad', () => {
  it('calcula los segundos por tarjeta de cada día y el promedio global', () => {
    const input = {
      library: biblioteca([mazo('mazo-a', 'Inglés')]),
      history: historial({
        cardEvents: [
          // Día 1: 2 tarjetas de 20 s → 40 s / 2 = 20 s por tarjeta.
          ...eventos(2, { deckId: 'mazo-a', day: DIA_1, activeMs: 20_000 }),
          // Día 2: 2 tarjetas de 40 s → 80 s / 2 = 40 s por tarjeta.
          ...eventos(2, { deckId: 'mazo-a', day: DIA_2, activeMs: 40_000 }),
        ],
      }),
    };

    const { speed } = buildStatsReport(input, consulta());
    const porDia = new Map(speed.series.map((point) => [point.day, point.value]));

    expect(porDia.get(DIA_1)).toBe(20);
    expect(porDia.get(DIA_2)).toBe(40);
    // 120 s entre 4 tarjetas = 30 s por tarjeta.
    expect(speed.averageSeconds).toBe(30);
    expect(speed.fastestDaySeconds).toBe(20);
    expect(speed.slowestDaySeconds).toBe(40);
  });

  it('nunca divide por cero: un día sin tarjetas no aparece en la serie', () => {
    const input = {
      library: biblioteca([mazo('mazo-a', 'Inglés')]),
      history: historial({ cardEvents: eventos(2, { deckId: 'mazo-a', day: DIA_1 }) }),
    };

    const { speed } = buildStatsReport(input, consulta());

    expect(speed.series.map((point) => point.day)).toEqual([DIA_1]);
    expect(speed.series.every((point) => Number.isFinite(point.value))).toBe(true);
  });

  it('sin ninguna tarjeta completada, la velocidad es desconocida', () => {
    const input = { library: biblioteca([mazo('mazo-a', 'Inglés')]), history: historial() };
    const { speed } = buildStatsReport(input, consulta());

    expect(speed.averageSeconds).toBeNull();
    expect(speed.fastestDaySeconds).toBeNull();
    expect(speed.slowestDaySeconds).toBeNull();
  });
});

describe('Racha', () => {
  /**
   * Global: 12 días seguidos, del 2026-08-12 al 2026-08-23 (hoy).
   * Mazo B: solo los 4 últimos, del 2026-08-20 al 2026-08-23.
   */
  function datasetDeRachas() {
    const dias = Array.from({ length: 12 }, (_, index) => {
      const dia = 12 + index;
      return `2026-08-${String(dia).padStart(2, '0')}`;
    });
    const cardEvents = [
      ...dias.map((day) => evento({ deckId: 'mazo-a', day })),
      ...dias.slice(-4).map((day) => evento({ deckId: 'mazo-b', day })),
    ];
    return {
      library: biblioteca([mazo('mazo-a', 'Inglés'), mazo('mazo-b', 'Matemáticas')]),
      history: historial({ cardEvents }),
    };
  }

  it('la racha global cubre los 12 días y la del mazo solo los suyos', () => {
    const input = datasetDeRachas();

    const global = buildStatsReport(input, consulta()).streak;
    const soloB = buildStatsReport(input, consulta({ scope: { kind: 'deck', deckId: 'mazo-b' } }))
      .streak;

    expect(global).toEqual({ current: 12, best: 12, daysStudied: 12 });
    expect(soloB).toEqual({ current: 4, best: 4, daysStudied: 4 });
  });

  it('sigue viva si se estudió ayer aunque hoy todavía no', () => {
    const input = {
      library: biblioteca([mazo('mazo-a', 'Inglés')]),
      history: historial({
        cardEvents: [
          evento({ deckId: 'mazo-a', day: '2026-08-21' }),
          evento({ deckId: 'mazo-a', day: '2026-08-22' }),
        ],
      }),
    };

    expect(buildStatsReport(input, consulta()).streak.current).toBe(2);
  });

  it('se rompe al perder un día entero, y la mejor racha recuerda la más larga', () => {
    const input = {
      library: biblioteca([mazo('mazo-a', 'Inglés')]),
      history: historial({
        cardEvents: [
          // Cinco días seguidos, un hueco, y luego solo hoy.
          ...['2026-08-10', '2026-08-11', '2026-08-12', '2026-08-13', '2026-08-14'].map((day) =>
            evento({ deckId: 'mazo-a', day }),
          ),
          evento({ deckId: 'mazo-a', day: HOY }),
        ],
      }),
    };

    const { streak } = buildStatsReport(input, consulta());
    expect(streak.current).toBe(1);
    expect(streak.best).toBe(5);
    expect(streak.daysStudied).toBe(6);
  });

  it('sin actividad, todo es cero y nada es NaN', () => {
    const report = buildStatsReport(
      { library: biblioteca(), history: historial() },
      consulta(),
    );
    expect(report.streak).toEqual({ current: 0, best: 0, daysStudied: 0 });
  });
});

describe('Actividad por hora', () => {
  it('agrupa por la hora local congelada en el evento y expone las 24 horas', () => {
    const input = {
      library: biblioteca([mazo('mazo-a', 'Inglés')]),
      history: historial({
        cardEvents: [
          ...eventos(12, { deckId: 'mazo-a', day: DIA_1, hour: 7 }),
          ...eventos(35, { deckId: 'mazo-a', day: DIA_1, hour: 8 }),
          ...eventos(48, { deckId: 'mazo-a', day: DIA_1, hour: 9 }),
        ],
      }),
    };

    const { hourly } = buildStatsReport(input, consulta());
    const porHora = new Map(hourly.hours.map((hour) => [hour.hour, hour.cards]));

    expect(hourly.hours).toHaveLength(24);
    expect(porHora.get(7)).toBe(12);
    expect(porHora.get(8)).toBe(35);
    expect(porHora.get(9)).toBe(48);
    expect(porHora.get(10)).toBe(0);
    expect(hourly.busiestHour).toBe(9);
    expect(hourly.total).toBe(95);
  });

  it('respeta el filtro por mazo', () => {
    const input = {
      library: biblioteca([mazo('mazo-a', 'Inglés'), mazo('mazo-b', 'Matemáticas')]),
      history: historial({
        cardEvents: [
          evento({ deckId: 'mazo-a', day: DIA_1, hour: 6 }),
          evento({ deckId: 'mazo-b', day: DIA_1, hour: 22 }),
        ],
      }),
    };

    const report = buildStatsReport(input, consulta({ scope: { kind: 'deck', deckId: 'mazo-a' } }));
    const porHora = new Map(report.hourly.hours.map((hour) => [hour.hour, hour.cards]));

    expect(porHora.get(6)).toBe(1);
    expect(porHora.get(22)).toBe(0);
  });
});

describe('Comparación de mazos', () => {
  it('compara tarjetas, tiempo, sesiones y promedio, de mayor a menor actividad', () => {
    const input = {
      library: biblioteca([
        mazo('mazo-a', 'Inglés'),
        mazo('mazo-b', 'Matemáticas'),
      ]),
      history: historial({
        cardEvents: [
          // Inglés: 4 tarjetas de 30 s = 120 s → 30 s por tarjeta.
          ...eventos(4, { deckId: 'mazo-a', day: DIA_1 }),
          // Matemáticas: 2 tarjetas de 45 s = 90 s → 45 s por tarjeta.
          ...eventos(2, { deckId: 'mazo-b', day: DIA_1, activeMs: 45_000 }),
        ],
        sessions: [
          sesion({ deckId: 'mazo-a', day: DIA_1, id: 's-a1' }),
          sesion({ deckId: 'mazo-a', day: DIA_2, id: 's-a2' }),
          sesion({ deckId: 'mazo-b', day: DIA_1, id: 's-b1' }),
        ],
      }),
    };

    const filas = buildStatsReport(input, consulta()).deckComparison;

    expect(filas).toEqual([
      {
        deckId: 'mazo-a',
        name: 'Inglés',
        deleted: false,
        studied: 4,
        activeMs: 120_000,
        sessions: 2,
        secondsPerCard: 30,
      },
      {
        deckId: 'mazo-b',
        name: 'Matemáticas',
        deleted: false,
        studied: 2,
        activeMs: 90_000,
        sessions: 1,
        secondsPerCard: 45,
      },
    ]);
  });

  it('no existe cuando el ámbito es un único mazo', () => {
    const report = buildStatsReport(
      datasetDelEnunciado(),
      consulta({ scope: { kind: 'deck', deckId: 'mazo-a' } }),
    );

    expect(report.deckComparison).toBeNull();
  });

  it('el historial de un mazo eliminado sigue apareciendo, nombrado y marcado', () => {
    const input = {
      // El mazo ya no está en la biblioteca; su historial sí.
      library: biblioteca([mazo('mazo-a', 'Inglés')]),
      history: historial({
        cardEvents: [
          ...eventos(3, { deckId: 'mazo-a', day: DIA_1 }),
          ...eventos(7, { deckId: 'mazo-borrado', day: DIA_1 }),
        ],
        deckSnapshots: [snapshot('mazo-borrado', 'Historia')],
      }),
    };

    const filas = buildStatsReport(input, consulta()).deckComparison ?? [];
    const borrado = filas.find((fila) => fila.deckId === 'mazo-borrado');

    expect(borrado?.name).toBe('Historia');
    expect(borrado?.deleted).toBe(true);
    expect(borrado?.studied).toBe(7);
    // El total global sigue incluyéndolo.
    expect(buildStatsReport(input, consulta()).activity.total).toBe(10);
  });

  it('un mazo eliminado sin snapshot se nombra de forma honesta, no se inventa', () => {
    const input = {
      library: biblioteca(),
      history: historial({ cardEvents: eventos(2, { deckId: 'mazo-fantasma', day: DIA_1 }) }),
    };

    const fila = (buildStatsReport(input, consulta()).deckComparison ?? [])[0];
    expect(fila?.name).toBe('Mazo eliminado');
    expect(fila?.deleted).toBe(true);
  });
});

describe('Tarjetas añadidas y origen', () => {
  it('distingue las altas registradas del baseline anterior al tracking', () => {
    const input = {
      library: biblioteca(
        [mazo('mazo-a', 'Inglés')],
        // c-1 y c-2 tienen alta registrada; c-3 y c-4 son anteriores al tracking.
        [
          carta('c-1', 'mazo-a'),
          carta('c-2', 'mazo-a'),
          carta('c-3', 'mazo-a'),
          carta('c-4', 'mazo-a'),
        ],
      ),
      history: historial({
        cardAdditions: [
          alta({ deckId: 'mazo-a', cardId: 'c-1', day: DIA_1 }),
          alta({ deckId: 'mazo-a', cardId: 'c-2', day: DIA_2 }),
        ],
      }),
    };

    const { added } = buildStatsReport(input, consulta());
    const porDia = new Map(added.series.map((point) => [point.day, point.value]));

    expect(added.totalInPeriod).toBe(2);
    expect(porDia.get(DIA_1)).toBe(1);
    expect(porDia.get(DIA_2)).toBe(1);
    expect(added.baseline).toBe(2);
    // Ninguna carta de baseline recibe una fecha inventada: la serie solo suma 2.
    expect(added.series.reduce((sum, point) => sum + point.value, 0)).toBe(2);
  });

  it('reparte el origen y agrupa lo que no se sabe bajo desconocido', () => {
    const input = {
      library: biblioteca(
        [mazo('mazo-a', 'Inglés')],
        ['c-1', 'c-2', 'c-3', 'c-4'].map((id) => carta(id, 'mazo-a')),
      ),
      history: historial({
        cardAdditions: [
          alta({ deckId: 'mazo-a', cardId: 'c-1', day: DIA_1, origin: 'manual' }),
          alta({ deckId: 'mazo-a', cardId: 'c-2', day: DIA_1, origin: 'csv' }),
          alta({ deckId: 'mazo-a', cardId: 'c-3', day: DIA_1, origin: 'xlsx' }),
        ],
      }),
    };

    const { origin } = buildStatsReport(input, consulta());
    const porOrigen = new Map(origin.slices.map((slice) => [slice.origin, slice]));

    expect(porOrigen.get('manual')?.cards).toBe(1);
    expect(porOrigen.get('csv')?.cards).toBe(1);
    expect(porOrigen.get('xlsx')?.cards).toBe(1);
    expect(porOrigen.get('markdown')?.cards).toBe(0);
    // c-4 no tiene alta: no se reparte entre los demás, se declara desconocida.
    expect(porOrigen.get('desconocido')?.cards).toBe(1);
    expect(porOrigen.get('desconocido')?.percent).toBe(25);
    expect(origin.total).toBe(4);
    expect(origin.known).toBe(3);
    expect(origin.unknown).toBe(1);
  });
});

describe('Sin datos', () => {
  it('un informe vacío no contiene NaN ni Infinity en ningún número', () => {
    const report = buildStatsReport(
      { library: biblioteca(), history: historial({ trackedSince: null }) },
      consulta({ period: '1y' }),
    );

    const numeros: number[] = [];
    const recorrer = (value: unknown) => {
      if (typeof value === 'number') {
        numeros.push(value);
        return;
      }
      if (Array.isArray(value)) {
        value.forEach(recorrer);
        return;
      }
      if (value && typeof value === 'object') {
        Object.values(value).forEach(recorrer);
      }
    };
    recorrer(report);

    expect(numeros.length).toBeGreaterThan(0);
    expect(numeros.every((value) => Number.isFinite(value))).toBe(true);
    expect(report.empty).toBe(true);
  });

  it('lo desconocido es null y no cero', () => {
    const report = buildStatsReport({ library: biblioteca(), history: historial() }, consulta());

    expect(report.speed.averageSeconds).toBeNull();
    expect(report.time.averagePerActiveDayMs).toBeNull();
    expect(report.activity.averageForDaysStudied).toBeNull();
    expect(report.hourly.busiestHour).toBeNull();
    // Los recuentos sí son cero: cero tarjetas estudiadas es un hecho, no un desconocido.
    expect(report.activity.total).toBe(0);
  });

  it('no inventa historia anterior: sin tracking no hay fecha de inicio', () => {
    const report = buildStatsReport(
      {
        library: biblioteca([mazo('mazo-a', 'Inglés')], [carta('c-1', 'mazo-a')]),
        history: historial({ trackedSince: null }),
      },
      consulta(),
    );

    expect(report.trackedSince).toBeNull();
    expect(report.added.totalInPeriod).toBe(0);
    expect(report.added.baseline).toBe(1);
  });
});

describe('Métricas diferidas', () => {
  it('desde TASK-007 solo queda diferido Card Ease, que FSRS no calcula', () => {
    // Future Due, Review Intervals, Retention y Answer Buttons ya existen: los hace posibles
    // el scheduler. Card Ease pertenece a SM-2; en FSRS su equivalente es Difficulty.
    const report = buildStatsReport({ library: biblioteca(), history: historial() }, consulta());

    expect(report.deferred.map((metric) => metric.anki)).toEqual(['Card Ease']);
    expect(report.deferred.every((metric) => metric.reason.length > 0)).toBe(true);
  });
});
