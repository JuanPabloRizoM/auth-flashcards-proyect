import { screen } from 'expo-router/testing-library';

import { cifra, crearEstudiarMazo, irA, montarApp, repositorios } from './statsHarness';

/**
 * La pantalla de estadísticas.
 *
 * Se conduce por la interfaz real: se estudian dos mazos con cifras distinguibles y se
 * comprueba que cambiar el ámbito y el periodo cambia de verdad lo que se ve. El ejemplo
 * es el del enunciado: Inglés 10 eventos, Matemáticas 30, global 40.
 */

async function prepararDosMazos() {
  const repos = repositorios();
  montarApp(repos);
  await screen.findByTestId('create-deck-button');

  await crearEstudiarMazo('Inglés', 'mazo-1', 10);
  await crearEstudiarMazo('Matemáticas', 'mazo-12', 30);

  await irA('nav-estadisticas');
  await screen.findByTestId('stats-scope');
  return repos;
}

describe('Navegación', () => {
  it('Estadísticas es un destino de primer nivel accesible desde la navegación', async () => {
    const repos = repositorios();
    montarApp(repos);
    await screen.findByTestId('create-deck-button');

    const enlace = screen.getByTestId('nav-estadisticas');
    expect(enlace.props.accessibilityState?.selected).toBe(false);

    await irA('nav-estadisticas');
    await screen.findByTestId('stats-scope');

    // El destino activo se anuncia, no solo se colorea.
    expect(screen.getByTestId('nav-estadisticas').props.accessibilityState?.selected).toBe(true);
    expect(screen.getByTestId('nav-mazos').props.accessibilityState?.selected).toBe(false);
  });

  it('la navegación existente sigue funcionando', async () => {
    const repos = repositorios();
    montarApp(repos);
    await screen.findByTestId('create-deck-button');

    await irA('nav-estadisticas');
    await screen.findByTestId('stats-scope');
    await irA('nav-mazos');
    await screen.findByTestId('create-deck-button');
    await irA('nav-componentes');

    expect(screen.getByTestId('nav-componentes').props.accessibilityState?.selected).toBe(true);
  });
});

describe('Filtro de ámbito', () => {
  it('todos los mazos agrega la actividad de los dos', async () => {
    await prepararDosMazos();

    expect(cifra('stats-today-metrics-tarjetas-estudiadas')).toBe('40');
    expect(cifra('stats-today-metrics-mazos-estudiados')).toBe('2');
  });

  it('elegir un mazo deja solo su actividad', async () => {
    await prepararDosMazos();

    await irA('stats-scope-mazo-1');
    expect(cifra('stats-today-metrics-tarjetas-estudiadas')).toBe('10');

    await irA('stats-scope-mazo-12');
    expect(cifra('stats-today-metrics-tarjetas-estudiadas')).toBe('30');
  });

  it('no hay leakage: el conteo de tarjetas de cada mazo es el suyo', async () => {
    await prepararDosMazos();

    await irA('stats-scope-mazo-1');
    expect(cifra('stats-counts-metrics-total-de-tarjetas')).toBe('10');

    await irA('stats-scope-mazo-12');
    expect(cifra('stats-counts-metrics-total-de-tarjetas')).toBe('30');

    await irA('stats-scope-todos');
    expect(cifra('stats-counts-metrics-total-de-tarjetas')).toBe('40');
  });

  it('cambiar el ámbito actualiza también las gráficas', async () => {
    await prepararDosMazos();

    // Cada barra anuncia su valor; la del día de hoy vale lo que se ha estudiado hoy.
    expect(screen.getAllByLabelText(/: 40 tarjetas\.$/).length).toBeGreaterThan(0);
    expect(screen.queryByLabelText(/: 10 tarjetas\.$/)).toBeNull();

    await irA('stats-scope-mazo-1');

    expect(screen.getAllByLabelText(/: 10 tarjetas\.$/).length).toBeGreaterThan(0);
    expect(screen.queryByLabelText(/: 40 tarjetas\.$/)).toBeNull();
  });

  it('cambiar el ámbito actualiza el calendario', async () => {
    await prepararDosMazos();

    expect(screen.getByText('Máximo: 40 tarjetas en un día')).toBeTruthy();

    await irA('stats-scope-mazo-1');
    expect(screen.getByText('Máximo: 10 tarjetas en un día')).toBeTruthy();
  });

  it('la racha se calcula también por mazo', async () => {
    await prepararDosMazos();

    expect(cifra('stats-streak-metrics-racha-actual')).toBe('1 día');

    await irA('stats-scope-mazo-1');
    expect(cifra('stats-streak-metrics-racha-actual')).toBe('1 día');
  });
});

describe('Comparación de mazos', () => {
  it('aparece en el ámbito global con una fila por mazo', async () => {
    await prepararDosMazos();

    expect(screen.getByTestId('stats-decks')).toBeTruthy();
    expect(screen.getByTestId('stats-decks-table-fila-mazo-1')).toBeTruthy();
    expect(screen.getByTestId('stats-decks-table-fila-mazo-12')).toBeTruthy();
  });

  it('desaparece cuando se selecciona un único mazo', async () => {
    await prepararDosMazos();
    await irA('stats-scope-mazo-1');

    expect(screen.queryByTestId('stats-decks')).toBeNull();
    expect(screen.queryByTestId('stats-decks-table')).toBeNull();
  });

  it('cada fila se anuncia con sus cuatro comparables', async () => {
    await prepararDosMazos();

    const etiqueta = String(
      screen.getByTestId('stats-decks-table-fila-mazo-12').props.accessibilityLabel,
    );

    expect(etiqueta).toContain('Matemáticas');
    expect(etiqueta).toContain('30 tarjetas estudiadas');
    expect(etiqueta).toContain('1 sesión');
    expect(etiqueta).toContain('por tarjeta');
  });
});

describe('Filtro de periodo', () => {
  it('cambiar de periodo recalcula lo que se muestra', async () => {
    await prepararDosMazos();

    // Toda la actividad es de hoy, así que entra en cualquier ventana; lo que cambia es el
    // divisor del promedio sobre el periodo: 40/30 en un mes y 40/90 en tres.
    await irA('stats-period-1m');
    expect(cifra('stats-activity-metrics-dias-estudiados')).toBe('1 de 30');
    expect(cifra('stats-activity-metrics-promedio-del-periodo')).toBe('1.3 / día');

    await irA('stats-period-3m');
    expect(cifra('stats-activity-metrics-dias-estudiados')).toBe('1 de 90');
    expect(cifra('stats-activity-metrics-promedio-del-periodo')).toBe('0.4 / día');

    await irA('stats-period-1y');
    expect(cifra('stats-activity-metrics-dias-estudiados')).toBe('1 de 365');
  });

  it('el filtro de periodo se combina con el de mazo', async () => {
    await prepararDosMazos();

    await irA('stats-scope-mazo-1');
    await irA('stats-period-3m');

    expect(cifra('stats-activity-metrics-total')).toBe('10');
    expect(cifra('stats-activity-metrics-dias-estudiados')).toBe('1 de 90');
  });
});

describe('Sin datos', () => {
  it('sin ninguna actividad muestra el estado vacío y no cifras inventadas', async () => {
    const repos = repositorios();
    montarApp({ ...repos, initialUrl: '/estadisticas' });
    await screen.findByTestId('stats-scope');

    expect(screen.getByTestId('stats-empty')).toBeTruthy();
    expect(screen.getByText('Sin actividad en este periodo')).toBeTruthy();
  });

  it('lo desconocido se muestra como un guion, no como un cero', async () => {
    const repos = repositorios();
    montarApp({ ...repos, initialUrl: '/estadisticas' });
    await screen.findByTestId('stats-scope');

    expect(cifra('stats-today-metrics-segundos-por-tarjeta')).toBe('—');
    expect(cifra('stats-speed-metrics-promedio-por-tarjeta')).toBe('—');
    expect(screen.getByText('Todavía sin tarjetas hoy')).toBeTruthy();
  });

  it('las gráficas muestran su estado vacío en vez de barras a cero', async () => {
    const repos = repositorios();
    montarApp({ ...repos, initialUrl: '/estadisticas' });
    await screen.findByTestId('stats-scope');

    expect(screen.getByTestId('stats-activity-chart-empty')).toBeTruthy();
    expect(screen.getByTestId('stats-calendar-heatmap-empty')).toBeTruthy();
    expect(screen.getByTestId('stats-speed-chart-empty')).toBeTruthy();
  });

  it('nunca aparece NaN, Infinity ni undefined en la pantalla', async () => {
    const repos = repositorios();
    montarApp({ ...repos, initialUrl: '/estadisticas' });
    await screen.findByTestId('stats-scope');

    for (const prohibido of ['NaN', 'Infinity', 'undefined']) {
      expect(screen.queryByText(new RegExp(prohibido))).toBeNull();
    }
  });

  it('dice desde cuándo hay historial fiable', async () => {
    const repos = repositorios();
    montarApp({ ...repos, initialUrl: '/estadisticas' });
    await screen.findByTestId('stats-scope');

    expect(
      screen.getByText(/Historial de estudio registrado desde .+\. Lo anterior a esa fecha/),
    ).toBeTruthy();
  });
});

describe('Métricas diferidas', () => {
  it('desde TASK-007 solo queda Card Ease, que FSRS no calcula', async () => {
    await prepararDosMazos();

    expect(screen.getByTestId('stats-deferred')).toBeTruthy();
    expect(screen.getByTestId('stats-deferred-table-fila-Card Ease')).toBeTruthy();
    // Las otras cuatro ya existen: las hace posibles el scheduler.
    for (const metrica of ['Future Due', 'Review Intervals', 'Retention', 'Answer Buttons']) {
      expect(screen.queryByTestId(`stats-deferred-table-fila-${metrica}`)).toBeNull();
    }
  });
});
