import { createTestClock, systemClock } from '../../src/lib/clock';

/**
 * El reloj inyectable.
 *
 * Existe para que el scheduling se pueda probar de verdad: fijar un instante, calificar,
 * adelantar el reloj y volver a consultar. Sin esto, comprobar que una tarjeta programada
 * para dentro de dos días no está disponible hoy exigiría esperar dos días.
 */
describe('Clock', () => {
  it('el reloj del sistema devuelve el instante actual', () => {
    const antes = Date.now();
    const leido = systemClock.now();
    const despues = Date.now();

    expect(leido).toBeGreaterThanOrEqual(antes);
    expect(leido).toBeLessThanOrEqual(despues);
  });

  it('el reloj de test se fija en un instante concreto y no se mueve solo', () => {
    const clock = createTestClock('2026-01-01T10:00:00.000Z');

    expect(clock.now()).toBe(Date.parse('2026-01-01T10:00:00.000Z'));
    expect(clock.now()).toBe(Date.parse('2026-01-01T10:00:00.000Z'));
  });

  it('avanza en milisegundos y en días naturales', () => {
    const clock = createTestClock('2026-01-01T10:00:00.000Z');

    clock.advance(90_000);
    expect(new Date(clock.now()).toISOString()).toBe('2026-01-01T10:01:30.000Z');

    clock.advanceDays(2);
    expect(new Date(clock.now()).toISOString()).toBe('2026-01-03T10:01:30.000Z');
  });

  it('se puede recolocar en otro instante', () => {
    const clock = createTestClock(0);
    clock.set('2026-06-15T08:30:00.000Z');

    expect(new Date(clock.now()).toISOString()).toBe('2026-06-15T08:30:00.000Z');
  });

  it('rechaza un instante que no se puede interpretar', () => {
    expect(() => createTestClock('mañana por la tarde')).toThrow(/Instante no reconocible/);
  });
});
