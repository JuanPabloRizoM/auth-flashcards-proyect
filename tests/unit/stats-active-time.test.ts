import {
  alwaysVisible,
  createActiveTimer,
  type VisibilitySource,
} from '../../src/features/stats/activeTime';

/**
 * Cronómetro de tiempo activo.
 *
 * Lo que hay que demostrar es que una pestaña en segundo plano no suma tiempo de estudio.
 * Se hace con un reloj y una visibilidad controlados: ni temporizadores reales ni esperas.
 */

function crearEntorno(visibleAlEmpezar = true) {
  let ahora = 1_000_000;
  let visible = visibleAlEmpezar;
  const oyentes: ((visible: boolean) => void)[] = [];

  const visibility: VisibilitySource = {
    isVisible: () => visible,
    subscribe: (listener) => {
      oyentes.push(listener);
      return () => {
        const index = oyentes.indexOf(listener);
        if (index >= 0) oyentes.splice(index, 1);
      };
    },
  };

  return {
    visibility,
    /** Avanza el reloj sin cambiar la visibilidad. */
    avanzar: (millis: number) => {
      ahora += millis;
    },
    ocultar: () => {
      visible = false;
      oyentes.forEach((listener) => listener(false));
    },
    mostrar: () => {
      visible = true;
      oyentes.forEach((listener) => listener(true));
    },
    now: () => ahora,
    oyentes,
  };
}

describe('Tiempo activo', () => {
  it('acumula mientras la superficie está visible', () => {
    const entorno = crearEntorno();
    const timer = createActiveTimer({ now: entorno.now, visibility: entorno.visibility });

    entorno.avanzar(12_000);

    expect(timer.elapsed()).toBe(12_000);
  });

  it('no cuenta el tiempo en segundo plano y lo reanuda al volver', () => {
    const entorno = crearEntorno();
    const timer = createActiveTimer({ now: entorno.now, visibility: entorno.visibility });

    entorno.avanzar(10_000); // visible: cuenta
    entorno.ocultar();
    entorno.avanzar(3_600_000); // una hora en segundo plano: no cuenta
    entorno.mostrar();
    entorno.avanzar(5_000); // visible otra vez: cuenta

    expect(timer.elapsed()).toBe(15_000);
  });

  it('una pestaña abierta tres horas en segundo plano no produce tres horas de estudio', () => {
    const entorno = crearEntorno();
    const timer = createActiveTimer({ now: entorno.now, visibility: entorno.visibility });

    entorno.avanzar(30_000);
    entorno.ocultar();
    entorno.avanzar(3 * 60 * 60 * 1000);

    expect(timer.elapsed()).toBe(30_000);
  });

  it('empezar oculto no acumula nada hasta que se muestra', () => {
    const entorno = crearEntorno(false);
    const timer = createActiveTimer({ now: entorno.now, visibility: entorno.visibility });

    entorno.avanzar(60_000);
    expect(timer.elapsed()).toBe(0);

    entorno.mostrar();
    entorno.avanzar(7_000);
    expect(timer.elapsed()).toBe(7_000);
  });

  it('dos avisos de visible seguidos no reinician el tramo en curso', () => {
    const entorno = crearEntorno();
    const timer = createActiveTimer({ now: entorno.now, visibility: entorno.visibility });

    entorno.avanzar(4_000);
    entorno.mostrar(); // aviso redundante
    entorno.avanzar(4_000);

    expect(timer.elapsed()).toBe(8_000);
  });

  it('reiniciar vuelve a cero y sigue midiendo', () => {
    const entorno = crearEntorno();
    const timer = createActiveTimer({ now: entorno.now, visibility: entorno.visibility });

    entorno.avanzar(9_000);
    timer.reset();
    expect(timer.elapsed()).toBe(0);

    entorno.avanzar(2_000);
    expect(timer.elapsed()).toBe(2_000);
  });

  it('reiniciar estando oculto no empieza a contar hasta volver', () => {
    const entorno = crearEntorno();
    const timer = createActiveTimer({ now: entorno.now, visibility: entorno.visibility });

    entorno.ocultar();
    timer.reset();
    entorno.avanzar(50_000);
    expect(timer.elapsed()).toBe(0);

    entorno.mostrar();
    entorno.avanzar(1_500);
    expect(timer.elapsed()).toBe(1_500);
  });

  it('detenerlo deja de escuchar cambios de visibilidad', () => {
    const entorno = crearEntorno();
    const timer = createActiveTimer({ now: entorno.now, visibility: entorno.visibility });

    expect(entorno.oyentes).toHaveLength(1);
    timer.stop();
    expect(entorno.oyentes).toHaveLength(0);
  });

  it('la fuente siempre visible sirve de reserva sin romper nada', () => {
    let ahora = 0;
    const timer = createActiveTimer({ now: () => ahora, visibility: alwaysVisible });

    ahora = 6_000;
    expect(timer.elapsed()).toBe(6_000);
    expect(() => timer.stop()).not.toThrow();
  });
});
