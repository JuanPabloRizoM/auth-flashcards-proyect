import { createFsrsScheduler } from '../../src/features/scheduler/fsrsAdapter';
import { newScheduling, type CardScheduling, type SchedulingState } from '../../src/features/scheduler/types';
import {
  buildStudyQueue,
  deckStudySummary,
  isAvailable,
  queueGroupOf,
} from '../../src/features/study/queue';
import type { Card } from '../../src/types/domain';

/**
 * La cola de estudio.
 *
 * Determinista por construcción: la misma biblioteca y el mismo instante producen siempre la
 * misma cola. Se comprueba la selección (qué entra y qué no) y el orden (aprendizaje
 * vencido, repasos vencidos, nuevas).
 */

const AHORA = Date.parse('2026-03-10T09:00:00.000Z');
const DAY = 86_400_000;

function programada(state: SchedulingState, dueEnMs: number): CardScheduling {
  return {
    ...newScheduling,
    state,
    due: AHORA + dueEnMs,
    lastReview: AHORA - DAY,
    stability: 5,
    difficulty: 5,
    scheduledDays: state === 'repaso' ? 4 : 0,
    reps: 2,
  };
}

function carta(id: string, scheduling: CardScheduling, deckId = 'mazo-a'): Card {
  return { id, deckId, front: `f ${id}`, back: `b ${id}`, scheduling };
}

const nueva1 = carta('nueva-1', { ...newScheduling });
const nueva2 = carta('nueva-2', { ...newScheduling });
const aprendiendoVencida = carta('apr-vencida', programada('aprendiendo', -5 * 60_000));
const reaprendiendoVencida = carta('rea-vencida', programada('reaprendiendo', -60_000));
const aprendiendoFutura = carta('apr-futura', programada('aprendiendo', 8 * 60_000));
const repasoVencidoViejo = carta('rep-viejo', programada('repaso', -3 * DAY));
const repasoVencidoReciente = carta('rep-reciente', programada('repaso', -1 * DAY));
const repasoFuturo = carta('rep-futuro', programada('repaso', 2 * DAY));

describe('isAvailable', () => {
  it('una carta nueva siempre está disponible', () => {
    expect(isAvailable(newScheduling, AHORA)).toBe(true);
  });

  it('una carta programada lo está justo al llegar su vencimiento', () => {
    const scheduling = programada('repaso', 0);
    expect(isAvailable(scheduling, AHORA - 1)).toBe(false);
    expect(isAvailable(scheduling, AHORA)).toBe(true);
  });
});

describe('isAvailable y scheduler.isDue no divergen', () => {
  // Son la misma regla escrita en dos sitios: la cola no depende de una instancia del
  // scheduler, pero tampoco puede contradecirla. Si alguien cambia una, este test lo enseña.
  const scheduler = createFsrsScheduler();
  const casos: CardScheduling[] = [
    newScheduling,
    programada('repaso', -DAY),
    programada('repaso', DAY),
    programada('aprendiendo', -60_000),
    programada('reaprendiendo', 60_000),
    // Estado imposible con datos sanos, pero aceptado por el validador de persistencia.
    { ...newScheduling, state: 'repaso', due: null, reps: 3, stability: 4, difficulty: 5 },
  ];

  it.each(casos.map((scheduling, index) => [index, scheduling]))(
    'caso %i',
    (_index, scheduling) => {
      expect(isAvailable(scheduling as CardScheduling, AHORA)).toBe(
        scheduler.isDue(scheduling as CardScheduling, AHORA),
      );
    },
  );
});

describe('queueGroupOf', () => {
  it('reparte cada estado en su grupo', () => {
    expect(queueGroupOf(newScheduling)).toBe('nueva');
    expect(queueGroupOf(programada('aprendiendo', 0))).toBe('aprendiendo');
    expect(queueGroupOf(programada('reaprendiendo', 0))).toBe('aprendiendo');
    expect(queueGroupOf(programada('repaso', 0))).toBe('repaso');
  });
});

describe('buildStudyQueue', () => {
  it('selecciona las cartas de aprendizaje vencidas y las pone primero', () => {
    const queue = buildStudyQueue([nueva1, repasoVencidoViejo, aprendiendoVencida], AHORA);

    expect(queue[0]?.id).toBe('apr-vencida');
  });

  it('incluye el reaprendizaje vencido en el mismo grupo que el aprendizaje', () => {
    const queue = buildStudyQueue([nueva1, reaprendiendoVencida, repasoVencidoViejo], AHORA);

    expect(queue.map((card) => card.id)).toEqual(['rea-vencida', 'rep-viejo', 'nueva-1']);
  });

  it('selecciona los repasos vencidos, del más atrasado al menos', () => {
    const queue = buildStudyQueue([repasoVencidoReciente, repasoVencidoViejo], AHORA);

    expect(queue.map((card) => card.id)).toEqual(['rep-viejo', 'rep-reciente']);
  });

  it('selecciona las cartas nuevas, al final y en el orden en que se crearon', () => {
    const queue = buildStudyQueue([nueva1, nueva2, repasoVencidoViejo], AHORA);

    expect(queue.map((card) => card.id)).toEqual(['rep-viejo', 'nueva-1', 'nueva-2']);
  });

  it('excluye los repasos con vencimiento futuro', () => {
    const queue = buildStudyQueue([repasoFuturo, nueva1], AHORA);

    expect(queue.map((card) => card.id)).toEqual(['nueva-1']);
  });

  it('excluye el aprendizaje cuyo turno todavía no ha llegado', () => {
    const queue = buildStudyQueue([aprendiendoFutura], AHORA);

    expect(queue).toEqual([]);
  });

  it('ordena los tres grupos: aprendizaje, repasos y nuevas', () => {
    const queue = buildStudyQueue(
      [nueva1, repasoFuturo, repasoVencidoReciente, aprendiendoVencida, repasoVencidoViejo, nueva2],
      AHORA,
    );

    expect(queue.map((card) => card.id)).toEqual([
      'apr-vencida',
      'rep-viejo',
      'rep-reciente',
      'nueva-1',
      'nueva-2',
    ]);
  });

  it('no contiene cartas de otro mazo: quien llama ya acota al mazo', () => {
    const deOtroMazo = carta('otra', { ...newScheduling }, 'mazo-b');
    const delMazoA = [nueva1, repasoVencidoViejo];

    const queue = buildStudyQueue(delMazoA, AHORA);

    expect(queue.some((card) => card.id === deOtroMazo.id)).toBe(false);
    expect(queue.every((card) => card.deckId === 'mazo-a')).toBe(true);
  });

  it('no depende de la posición: barajar la entrada da la misma cola', () => {
    const cartas = [nueva1, repasoVencidoReciente, aprendiendoVencida, repasoVencidoViejo];
    const alReves = [...cartas].reverse();

    expect(buildStudyQueue(alReves, AHORA).map((card) => card.id)).toEqual([
      'apr-vencida',
      'rep-viejo',
      'rep-reciente',
      'nueva-1',
    ]);
  });

  it('una carta eliminada de la biblioteca no puede estar en la cola', () => {
    const conTodas = [nueva1, nueva2, repasoVencidoViejo];
    const sinLaBorrada = conTodas.filter((card) => card.id !== 'nueva-2');

    expect(buildStudyQueue(sinLaBorrada, AHORA).map((card) => card.id)).not.toContain('nueva-2');
  });

  it('avanzar el reloj hace elegible una carta que estaba en el futuro', () => {
    expect(buildStudyQueue([repasoFuturo], AHORA)).toEqual([]);
    expect(buildStudyQueue([repasoFuturo], AHORA + 2 * DAY).map((card) => card.id)).toEqual([
      'rep-futuro',
    ]);
  });
});

describe('deckStudySummary', () => {
  const cartas = [
    nueva1,
    nueva2,
    aprendiendoVencida,
    aprendiendoFutura,
    repasoVencidoViejo,
    repasoVencidoReciente,
    repasoFuturo,
  ];

  it('cuenta las nuevas, las que están aprendiendo y las que toca repasar', () => {
    const summary = deckStudySummary(cartas, AHORA);

    expect(summary.nuevas).toBe(2);
    expect(summary.aprendiendo).toBe(1);
    expect(summary.repasar).toBe(2);
  });

  it('no cuenta como vencida una tarjeta programada para el futuro', () => {
    const summary = deckStudySummary([repasoFuturo], AHORA);

    expect(summary.repasar).toBe(0);
    expect(summary.disponibles).toBe(0);
  });

  it('los contadores describen exactamente la cola que se construiría ahora', () => {
    const summary = deckStudySummary(cartas, AHORA);

    expect(summary.disponibles).toBe(buildStudyQueue(cartas, AHORA).length);
  });

  it('avisa aparte de las que están aprendiendo pero todavía no toca', () => {
    const summary = deckStudySummary(cartas, AHORA);

    expect(summary.aprendiendoMasTarde).toBe(1);
    expect(summary.total).toBe(7);
  });

  it('sale del estado de cada tarjeta, no de su posición en la lista', () => {
    const alReves = [...cartas].reverse();

    expect(deckStudySummary(alReves, AHORA)).toEqual(deckStudySummary(cartas, AHORA));
  });
});
