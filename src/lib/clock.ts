/**
 * Reloj inyectable.
 *
 * El scheduler y el estudio no llaman a `Date.now()` por su cuenta: reciben un reloj. Es lo
 * que permite que un test fije un instante, califique, adelante el reloj y vuelva a
 * consultar, que es la única forma de comprobar de verdad que una tarjeta programada para
 * dentro de dos días no está disponible hoy y sí lo está pasado mañana.
 *
 * La unidad es siempre milisegundos desde epoch, igual que el historial de TASK-006.
 */

export type Clock = {
  /** Instante actual en milisegundos desde epoch. */
  now: () => number;
};

/** El reloj real del dispositivo. Es el que usa la aplicación. */
export const systemClock: Clock = {
  now: () => Date.now(),
};

export type TestClock = Clock & {
  /** Coloca el reloj en un instante concreto. Acepta epoch o texto ISO 8601. */
  set: (at: number | string) => void;
  /** Adelanta (o atrasa, con un valor negativo) el reloj. */
  advance: (millis: number) => void;
  /** Adelanta el reloj un número de días naturales. */
  advanceDays: (days: number) => void;
};

const DAY_MS = 86_400_000;

/**
 * Reloj controlable, para tests.
 *
 * Vive junto al reloj real y no en la carpeta de tests porque también lo usan las pruebas de
 * integración que montan la aplicación entera: es parte del contrato de inyección, no del
 * andamiaje de un test concreto.
 */
export function createTestClock(start: number | string): TestClock {
  let current = toEpoch(start);
  return {
    now: () => current,
    set: (at) => {
      current = toEpoch(at);
    },
    advance: (millis) => {
      current += millis;
    },
    advanceDays: (days) => {
      current += days * DAY_MS;
    },
  };
}

function toEpoch(at: number | string): number {
  if (typeof at === 'number') return at;
  const millis = Date.parse(at);
  if (Number.isNaN(millis)) {
    throw new Error(`Instante no reconocible para el reloj: ${at}`);
  }
  return millis;
}
