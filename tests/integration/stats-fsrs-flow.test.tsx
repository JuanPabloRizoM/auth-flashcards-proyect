import { screen } from 'expo-router/testing-library';

import { createTestClock } from '../../src/lib/clock';
import {
  abrirMazo,
  anadirCarta,
  calificar,
  cifra,
  crearMazo,
  irA,
  montarApp,
  repositorios,
} from './statsHarness';

/**
 * Las estadísticas de repetición espaciada, vistas desde la aplicación.
 *
 * Se estudia de verdad, calificando, y después se leen las cifras de la pantalla. Lo que
 * importa aquí es el aislamiento entre mazos y que eliminar una carta o un mazo no borre el
 * historial pero sí lo saque de lo que está programado.
 */

const INICIO = '2026-03-10T09:00:00.000Z';

function entorno() {
  return { clock: createTestClock(INICIO), ...repositorios() };
}

/** Crea un mazo con `cartas` tarjetas y las califica una a una con lo que se le indique. */
async function crearYCalificar(
  nombre: string,
  deckId: string,
  calificaciones: readonly Parameters<typeof calificar>[0][],
) {
  await irA('nav-mazos');
  await screen.findByTestId('create-deck-button');
  await crearMazo(nombre);
  await abrirMazo(deckId);
  for (let index = 0; index < calificaciones.length; index += 1) {
    await anadirCarta(`${nombre} frente ${index}`, `${nombre} reverso ${index}`);
  }
  await irA('study-button');
  await screen.findByTestId('study-card');
  for (const rating of calificaciones) {
    await calificar(rating);
  }
  // Si quedaban tarjetas se termina la sesión a mano; si no, la pantalla ya la ha cerrado.
  await irA(
    screen.queryByTestId('finish-session-button') ? 'finish-session-button' : 'finish-back-button',
  );
  await screen.findByTestId('add-card-button');
}

async function verEstadisticas() {
  await irA('nav-estadisticas');
  await screen.findByTestId('stats-counts-metrics');
}

describe('Answer Buttons en la pantalla', () => {
  it('cuenta cada calificación y respeta el ámbito', async () => {
    const app = entorno();
    montarApp(app);
    await screen.findByTestId('create-deck-button');

    // Inglés: 1 Otra vez, 1 Difícil, 3 Fácil. Matemáticas: 3 Bien.
    // Los identificadores son correlativos: cinco cartas dejan el mazo siguiente en mazo-7.
    await crearYCalificar('Inglés', 'mazo-1', ['otra-vez', 'dificil', 'facil', 'facil', 'facil']);
    await crearYCalificar('Matemáticas', 'mazo-7', ['bien', 'bien', 'bien']);

    await verEstadisticas();

    // Global: las cinco calificaciones de Inglés más las tres de Matemáticas.
    expect(cifra('stats-answer-buttons-metrics-respuestas-calificadas')).toBe('8');
    expect(cifra('stats-answer-buttons-metrics-otra-vez')).toBe('1');
    expect(cifra('stats-answer-buttons-metrics-dificil')).toBe('1');
    expect(cifra('stats-answer-buttons-metrics-bien')).toBe('3');
    expect(cifra('stats-answer-buttons-metrics-facil')).toBe('3');
  });

  it('sin ninguna calificación explica desde cuándo habrá datos', async () => {
    const app = entorno();
    montarApp(app);
    await screen.findByTestId('create-deck-button');
    await crearMazo('Inglés');
    await abrirMazo('mazo-1');
    await anadirCarta('frente', 'reverso');

    await verEstadisticas();

    expect(screen.getByTestId('stats-answer-buttons-empty')).toBeTruthy();
    expect(screen.getByTestId('stats-retention-empty')).toBeTruthy();
  });
});

describe('Textos que la pantalla ya no puede decir', () => {
  it('no afirma que el estudio no califica, porque desde TASK-007 sí lo hace', async () => {
    const app = entorno();
    montarApp(app);
    await screen.findByTestId('create-deck-button');
    await crearYCalificar('Inglés', 'mazo-1', ['bien']);

    await verEstadisticas();

    expect(screen.queryByText(/el estudio todavía no califica/)).toBeNull();
  });

  it('anuncia el horizonte de los próximos repasos mirando hacia delante', async () => {
    const app = entorno();
    montarApp(app);
    await screen.findByTestId('create-deck-button');
    await crearYCalificar('Inglés', 'mazo-1', ['bien']);

    await verEstadisticas();

    // El periodo por defecto es 1 mes: 30 días hacia delante, no "último mes".
    expect(screen.getByText(/Repasos programados para los próximos 30 días/)).toBeTruthy();
  });
});

describe('Retención real', () => {
  it('dice cuántas respuestas quedan fuera por ser de tarjetas en aprendizaje', async () => {
    const app = entorno();
    montarApp(app);
    await screen.findByTestId('create-deck-button');

    // Todas las calificaciones son de tarjetas nuevas o en aprendizaje: ninguna entra en la
    // tabla de retención, y la pantalla lo dice en vez de callarlo.
    await crearYCalificar('Inglés', 'mazo-1', ['bien', 'bien']);

    await verEstadisticas();

    expect(screen.getByTestId('stats-retention-excluded')).toBeTruthy();
    expect(
      screen.getByText(/2 respuestas quedan fuera por ser de tarjetas que todavía se estaban aprendiendo/),
    ).toBeTruthy();
  });
});

describe('Conteo por estado del scheduler', () => {
  it('reparte las tarjetas entre Nuevas, Aprendiendo, Reaprendiendo, Young y Mature', async () => {
    const app = entorno();
    montarApp(app);
    await screen.findByTestId('create-deck-button');

    await crearYCalificar('Inglés', 'mazo-1', ['facil', 'otra-vez']);
    // Queda: una en repaso (Fácil) y una en aprendizaje (Otra vez, sin volver a calificar).
    await irA('nav-mazos');
    await abrirMazo('mazo-1');
    await anadirCarta('sin estudiar', 'todavía');

    await verEstadisticas();

    expect(cifra('stats-scheduler-counts-nuevas')).toBe('1');
    expect(cifra('stats-scheduler-counts-aprendiendo')).toBe('1');
    expect(cifra('stats-scheduler-counts-reaprendiendo')).toBe('0');
    expect(cifra('stats-scheduler-counts-young')).toBe('1');
    expect(cifra('stats-scheduler-counts-mature')).toBe('0');
    expect(cifra('stats-counts-metrics-total-de-tarjetas')).toBe('3');
  });
});

describe('Eliminar no borra el historial pero sí lo programado', () => {
  it('una carta eliminada deja de generar próximos repasos y conserva sus calificaciones', async () => {
    const app = entorno();
    montarApp(app);
    await screen.findByTestId('create-deck-button');

    await crearYCalificar('Inglés', 'mazo-1', ['facil', 'facil']);

    await verEstadisticas();
    const programadasAntes = cifra('stats-future-due-metrics-programadas-en-el-horizonte');
    const calificacionesAntes = cifra('stats-answer-buttons-metrics-respuestas-calificadas');
    expect(programadasAntes).toBe('2');
    expect(calificacionesAntes).toBe('2');

    // Se elimina una de las dos cartas.
    await irA('nav-mazos');
    await abrirMazo('mazo-1');
    await irA('delete-card-carta-2');
    await irA('delete-confirm-confirm');

    await verEstadisticas();

    // Ya no está programada…
    expect(cifra('stats-future-due-metrics-programadas-en-el-horizonte')).toBe('1');
    // …pero sus calificaciones siguen en el historial.
    expect(cifra('stats-answer-buttons-metrics-respuestas-calificadas')).toBe('2');
  });

  it('un mazo eliminado desaparece de lo programado y sigue en el historial global', async () => {
    const app = entorno();
    montarApp(app);
    await screen.findByTestId('create-deck-button');

    await crearYCalificar('Inglés', 'mazo-1', ['facil', 'facil']);
    await crearYCalificar('Matemáticas', 'mazo-4', ['bien']);

    await verEstadisticas();
    expect(cifra('stats-answer-buttons-metrics-respuestas-calificadas')).toBe('3');
    // Las dos de Inglés, a días vista, y la de Matemáticas, a minutos: tres programadas.
    expect(cifra('stats-future-due-metrics-programadas-en-el-horizonte')).toBe('3');

    // Se elimina Inglés entero.
    await irA('nav-mazos');
    await abrirMazo('mazo-1');
    await irA('delete-deck-button');
    await irA('delete-confirm-confirm');

    await verEstadisticas();

    // Solo queda programada la de Matemáticas.
    expect(cifra('stats-future-due-metrics-programadas-en-el-horizonte')).toBe('1');
    // Pero las tres calificaciones siguen contando en el histórico global.
    expect(cifra('stats-answer-buttons-metrics-respuestas-calificadas')).toBe('3');
  });
});

describe('Aislamiento por mazo', () => {
  it('el ámbito de un mazo no muestra ni una calificación del otro', async () => {
    const app = entorno();
    montarApp(app);
    await screen.findByTestId('create-deck-button');

    await crearYCalificar('Inglés', 'mazo-1', ['facil', 'facil']);
    await crearYCalificar('Matemáticas', 'mazo-4', ['bien', 'bien', 'bien']);

    await verEstadisticas();
    expect(cifra('stats-answer-buttons-metrics-respuestas-calificadas')).toBe('5');

    // Solo Inglés.
    await seleccionar('stats-scope', 'mazo-1');
    expect(cifra('stats-answer-buttons-metrics-respuestas-calificadas')).toBe('2');
    expect(cifra('stats-answer-buttons-metrics-bien')).toBe('0');

    // Solo Matemáticas.
    await seleccionar('stats-scope', 'mazo-4');
    expect(cifra('stats-answer-buttons-metrics-respuestas-calificadas')).toBe('3');
    expect(cifra('stats-answer-buttons-metrics-facil')).toBe('0');
  });
});

/** Cambia el valor de un selector de la pantalla de estadísticas. */
async function seleccionar(testID: string, valor: string) {
  await irA(`${testID}-${valor}`);
}
