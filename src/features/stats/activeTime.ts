/**
 * Cronómetro de tiempo activo.
 *
 * Una pestaña abierta tres horas en segundo plano no son tres horas de estudio. Este
 * cronómetro solo acumula mientras la superficie está visible: al ocultarse se detiene y
 * al volver se reanuda, sin perder lo acumulado.
 *
 * Limitaciones conocidas, documentadas también en progress/current.md:
 *
 * - Mide visibilidad, no atención. Una ventana visible pero desatendida sigue sumando.
 * - En web se apoya en `visibilitychange`, que cubre cambiar de pestaña, minimizar y
 *   bloquear el dispositivo, pero no tapar la ventana con otra aplicación encima.
 * - En nativo se apoya en `AppState`: `background` e `inactive` detienen el cronómetro.
 * - La rama nativa no se ha ejecutado nunca en dispositivo ni simulador; el gate E2E de
 *   este proyecto es solo web.
 */

export type VisibilitySource = {
  isVisible: () => boolean;
  /** Devuelve la función para dejar de escuchar. */
  subscribe: (listener: (visible: boolean) => void) => () => void;
};

export type ActiveTimer = {
  /** Milisegundos activos acumulados desde el último `reset`. */
  elapsed: () => number;
  /** Vuelve a cero y sigue midiendo si la superficie está visible. */
  reset: () => void;
  /** Deja de escuchar cambios de visibilidad. */
  stop: () => void;
};

export type ActiveTimerOptions = {
  now: () => number;
  visibility: VisibilitySource;
};

export function createActiveTimer({ now, visibility }: ActiveTimerOptions): ActiveTimer {
  let accumulated = 0;
  /** Instante en que empezó el tramo visible actual. `null` mientras está oculto. */
  let runningSince: number | null = visibility.isVisible() ? now() : null;

  const settle = () => {
    if (runningSince !== null) {
      accumulated += Math.max(0, now() - runningSince);
      runningSince = null;
    }
  };

  const unsubscribe = visibility.subscribe((visible) => {
    if (visible) {
      // Reanudar dos veces seguidas no debe reiniciar el tramo en curso.
      if (runningSince === null) runningSince = now();
      return;
    }
    settle();
  });

  return {
    elapsed: () => accumulated + (runningSince === null ? 0 : Math.max(0, now() - runningSince)),
    reset: () => {
      accumulated = 0;
      runningSince = visibility.isVisible() ? now() : null;
    },
    stop: unsubscribe,
  };
}

/** Fuente que siempre está visible. Para entornos sin noción de visibilidad y para tests. */
export const alwaysVisible: VisibilitySource = {
  isVisible: () => true,
  subscribe: () => () => undefined,
};
