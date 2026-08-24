import { buildStatsReport } from '../../src/features/stats/engine';
import {
  addDays,
  dayInRange,
  daysBetween,
  enumerateDays,
  localDayOf,
  localHourOf,
  periodRange,
  weekdayOfDay,
} from '../../src/features/stats/time';
import type { StatsPeriod } from '../../src/features/stats/types';
import { biblioteca, evento, historial, mazo, resetSequence } from '../fixtures/stats/builders';

/**
 * Fronteras temporales.
 *
 * Todo lo que decide qué entra y qué no en un periodo se comprueba con días concretos, no
 * con "más o menos un mes". Un periodo mal delimitado por un día desplaza en silencio todas
 * las cifras del informe.
 */

const HOY = '2026-08-23';

beforeEach(resetSequence);

describe('Aritmética de días', () => {
  it('suma y resta días atravesando el cambio de mes y de año', () => {
    expect(addDays('2026-08-31', 1)).toBe('2026-09-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('cuenta bien un año bisiesto', () => {
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(daysBetween('2024-02-28', '2024-03-01')).toBe(2);
  });

  it('enumera rangos inclusivos y devuelve vacío si están invertidos', () => {
    expect(enumerateDays('2026-08-20', '2026-08-23')).toEqual([
      '2026-08-20',
      '2026-08-21',
      '2026-08-22',
      '2026-08-23',
    ]);
    expect(enumerateDays('2026-08-23', '2026-08-23')).toEqual(['2026-08-23']);
    expect(enumerateDays('2026-08-23', '2026-08-20')).toEqual([]);
  });

  it('no se descuadra al atravesar un cambio de horario de verano', () => {
    // En Europa el horario de verano cambia el último domingo de octubre de 2026 (día 25).
    // Ese día real dura 25 horas; como día del calendario, sigue siendo un día.
    expect(daysBetween('2026-10-24', '2026-10-26')).toBe(2);
    expect(enumerateDays('2026-10-24', '2026-10-26')).toHaveLength(3);
    expect(addDays('2026-10-25', 1)).toBe('2026-10-26');
  });

  it('el día de la semana es estable', () => {
    // 2026-08-23 es domingo.
    expect(weekdayOfDay('2026-08-23')).toBe(0);
    expect(weekdayOfDay('2026-08-24')).toBe(1);
    expect(weekdayOfDay('2026-08-29')).toBe(6);
  });
});

describe('Ventanas de periodo', () => {
  const casos: readonly { period: StatsPeriod; dias: number; primerDia: string }[] = [
    { period: '1m', dias: 30, primerDia: '2026-07-25' },
    { period: '3m', dias: 90, primerDia: '2026-05-26' },
    { period: '1y', dias: 365, primerDia: '2025-08-24' },
  ];

  it.each(casos)('$period cubre $dias días terminando hoy', ({ period, dias, primerDia }) => {
    const range = periodRange(period, HOY);

    expect(range.days).toBe(dias);
    expect(range.toDay).toBe(HOY);
    expect(range.fromDay).toBe(primerDia);
    // Los dos extremos incluidos suman exactamente los días del periodo.
    expect(daysBetween(range.fromDay!, range.toDay) + 1).toBe(dias);
  });

  it('todo el historial no tiene frontera inferior', () => {
    const range = periodRange('all', HOY);
    expect(range.fromDay).toBeNull();
    expect(range.days).toBeNull();
  });

  it.each(casos)('$period incluye su primer día y excluye el anterior', ({ period, primerDia }) => {
    const range = periodRange(period, HOY);

    expect(dayInRange(primerDia, range)).toBe(true);
    expect(dayInRange(addDays(primerDia, -1), range)).toBe(false);
    expect(dayInRange(HOY, range)).toBe(true);
    // Un día futuro queda fuera aunque el reloj del dispositivo se haya adelantado.
    expect(dayInRange(addDays(HOY, 1), range)).toBe(false);
  });

  it('todo el historial no descarta ni el evento más antiguo', () => {
    const range = periodRange('all', HOY);
    expect(dayInRange('1999-01-01', range)).toBe(true);
  });
});

describe('Fronteras aplicadas al informe', () => {
  /** Un evento exactamente en el primer día de cada ventana, y otro justo antes. */
  function datasetDeFrontera(period: StatsPeriod) {
    const range = periodRange(period, HOY);
    const dentro = range.fromDay!;
    const fuera = addDays(dentro, -1);
    return {
      dentro,
      fuera,
      input: {
        library: biblioteca([mazo('mazo-a', 'Inglés')]),
        history: historial({
          cardEvents: [
            evento({ deckId: 'mazo-a', day: dentro }),
            evento({ deckId: 'mazo-a', day: fuera }),
          ],
        }),
      },
    };
  }

  it.each(['1m', '3m', '1y'] as const)(
    'en %s entra el evento del primer día y queda fuera el del día anterior',
    (period) => {
      const { input } = datasetDeFrontera(period);
      const report = buildStatsReport(input, { scope: { kind: 'all' }, period, today: HOY });

      expect(report.activity.total).toBe(1);
    },
  );

  it('en todo el historial entran los dos', () => {
    const { input } = datasetDeFrontera('1y');
    const report = buildStatsReport(input, {
      scope: { kind: 'all' },
      period: 'all',
      today: HOY,
    });

    expect(report.activity.total).toBe(2);
  });

  it('cambiar de periodo recalcula el total', () => {
    const input = {
      library: biblioteca([mazo('mazo-a', 'Inglés')]),
      history: historial({
        cardEvents: [
          evento({ deckId: 'mazo-a', day: HOY }),
          evento({ deckId: 'mazo-a', day: '2026-06-01' }),
          evento({ deckId: 'mazo-a', day: '2020-01-01' }),
        ],
      }),
    };
    const totalCon = (period: StatsPeriod) =>
      buildStatsReport(input, { scope: { kind: 'all' }, period, today: HOY }).activity.total;

    expect(totalCon('1m')).toBe(1);
    expect(totalCon('3m')).toBe(2);
    expect(totalCon('1y')).toBe(2);
    expect(totalCon('all')).toBe(3);
  });
});

describe('Zona horaria', () => {
  /**
   * El día y la hora locales se congelan al registrar el evento, así que agrupar no vuelve
   * a pasar por ninguna zona horaria. Se comprueba ejecutando la misma agregación con la
   * `TZ` del proceso cambiada a los dos extremos del planeta.
   */
  const original = process.env.TZ;
  afterEach(() => {
    process.env.TZ = original;
  });

  function agregadoConTz(tz: string) {
    process.env.TZ = tz;
    const input = {
      library: biblioteca([mazo('mazo-a', 'Inglés')]),
      history: historial({
        cardEvents: [
          evento({ deckId: 'mazo-a', day: '2026-08-22', hour: 23 }),
          evento({ deckId: 'mazo-a', day: '2026-08-23', hour: 0 }),
        ],
      }),
    };
    const report = buildStatsReport(input, {
      scope: { kind: 'all' },
      period: 'all',
      today: HOY,
    });
    return {
      porDia: report.calendar.days.map((day) => [day.day, day.cards] as const),
      porHora: report.hourly.hours.filter((hour) => hour.cards > 0),
    };
  }

  it('agrupa igual en UTC que en Kiritimati (UTC+14)', () => {
    const utc = agregadoConTz('UTC');
    const kiritimati = agregadoConTz('Pacific/Kiritimati');

    expect(kiritimati).toEqual(utc);
    expect(utc.porHora).toEqual([
      { hour: 0, cards: 1 },
      { hour: 23, cards: 1 },
    ]);
  });

  it('agrupa igual en Honolulu (UTC-10) que en Madrid', () => {
    expect(agregadoConTz('Pacific/Honolulu')).toEqual(agregadoConTz('Europe/Madrid'));
  });

  it('el día y la hora locales se leen del reloj del dispositivo al registrar', () => {
    // A las 23:30 locales de un 22 de agosto, el día local es el 22 y la hora la 23, sea
    // cual sea el desfase con UTC. Es lo que el registro congela en el evento.
    const instante = new Date(2026, 7, 22, 23, 30, 0).getTime();

    expect(localDayOf(instante)).toBe('2026-08-22');
    expect(localHourOf(instante)).toBe(23);
  });
});
