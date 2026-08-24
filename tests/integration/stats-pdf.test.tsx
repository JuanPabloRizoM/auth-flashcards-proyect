import { screen } from 'expo-router/testing-library';

import type { SaveFileResult } from '../../src/lib/files/types';
import { expectValidPdfStructure } from '../fixtures/stats/pdfReader';
import { cifra, crearEstudiarMazo, irA, montarApp, repositorios } from './statsHarness';

/**
 * Generación del reporte desde la pantalla.
 *
 * Se comprueban las dos cosas que importan: que el PDF sale del mismo motor que el panel,
 * de modo que las cifras coincidan literalmente, y que el reporte de un mazo no arrastra
 * los datos de los demás.
 */

/** Guardador de mentira que se queda con los bytes en vez de escribir en ninguna parte. */
function guardadorDePrueba() {
  const guardados: { name: string; bytes: Uint8Array }[] = [];
  return {
    guardados,
    saver: (name: string, bytes: Uint8Array): SaveFileResult => {
      guardados.push({ name, bytes });
      return { status: 'ok', where: 'descarga' };
    },
  };
}

async function prepararConReporte() {
  const guardador = guardadorDePrueba();
  const repos = repositorios();
  montarApp({ ...repos, fileSaver: guardador.saver });
  await screen.findByTestId('create-deck-button');

  await crearEstudiarMazo('Inglés', 'mazo-1', 10);
  await crearEstudiarMazo('Matemáticas', 'mazo-12', 30);

  await irA('nav-estadisticas');
  await screen.findByTestId('stats-scope');

  return { guardador, repos };
}

async function generar() {
  await irA('report-open');
  await screen.findByTestId('report-confirm');
  await irA('report-confirm');
  await screen.findByTestId('report-feedback');
}

describe('Generar el reporte', () => {
  it('produce un PDF real y confirma qué se ha generado', async () => {
    const { guardador } = await prepararConReporte();
    await generar();

    expect(guardador.guardados).toHaveLength(1);
    const [archivo] = guardador.guardados;
    expect(archivo!.name.endsWith('.pdf')).toBe(true);

    const pdf = expectValidPdfStructure(archivo!.bytes);
    expect(pdf.pageCount).toBeGreaterThan(1);
    expect(screen.getByTestId('report-feedback')).toBeTruthy();
  });

  it('la configuración parte de lo que se está viendo', async () => {
    await prepararConReporte();
    await irA('stats-scope-mazo-1');
    await irA('stats-period-3m');
    await irA('report-open');

    expect(screen.getByTestId('report-scope-mazo-1').props.accessibilityState?.selected).toBe(true);
    expect(screen.getByTestId('report-period-3m').props.accessibilityState?.selected).toBe(true);
  });

  it('se puede cancelar sin generar nada', async () => {
    const { guardador } = await prepararConReporte();
    await irA('report-open');
    await screen.findByTestId('report-cancel');
    await irA('report-cancel');

    expect(screen.queryByTestId('report-confirm')).toBeNull();
    expect(guardador.guardados).toHaveLength(0);
  });
});

describe('El ámbito del reporte manda', () => {
  it('el reporte global contiene los dos mazos y el total', async () => {
    const { guardador } = await prepararConReporte();
    await generar();

    const pdf = expectValidPdfStructure(guardador.guardados[0]!.bytes);

    expect(pdf.text).toContain('Todos los mazos');
    expect(pdf.textRuns).toContain('Inglés');
    expect(pdf.textRuns).toContain('Matemáticas');
    expect(pdf.textRuns).toContain('40');
  });

  it('el reporte de un mazo no contiene los datos del otro', async () => {
    const { guardador } = await prepararConReporte();

    await irA('report-open');
    await screen.findByTestId('report-scope-mazo-1');
    await irA('report-scope-mazo-1');
    await irA('report-confirm');
    await screen.findByTestId('report-feedback');

    const pdf = expectValidPdfStructure(guardador.guardados[0]!.bytes);

    expect(pdf.textRuns).toContain('Inglés');
    expect(pdf.textRuns).not.toContain('Matemáticas');
    // 10 es lo de Inglés; 30 y 40 son de Matemáticas y del total, y no deben estar.
    expect(pdf.textRuns).toContain('10');
    expect(pdf.textRuns).not.toContain('30');
    expect(pdf.textRuns).not.toContain('40');
    expect(pdf.text).not.toContain('Comparación de mazos');
  });

  it('cambiar el ámbito del reporte cambia el PDF generado', async () => {
    const { guardador } = await prepararConReporte();

    await irA('report-open');
    await irA('report-scope-mazo-1');
    await irA('report-confirm');
    await screen.findByTestId('report-feedback');

    await irA('report-scope-mazo-12');
    await irA('report-confirm');

    expect(guardador.guardados).toHaveLength(2);
    const ingles = expectValidPdfStructure(guardador.guardados[0]!.bytes);
    const mates = expectValidPdfStructure(guardador.guardados[1]!.bytes);

    expect(ingles.textRuns).toContain('Inglés');
    expect(ingles.textRuns).not.toContain('Matemáticas');
    expect(mates.textRuns).toContain('Matemáticas');
    expect(mates.textRuns).not.toContain('Inglés');
  });

  it('el nombre del archivo refleja el ámbito y el periodo', async () => {
    const { guardador } = await prepararConReporte();

    await irA('report-open');
    await irA('report-scope-mazo-1');
    await irA('report-period-1y');
    await irA('report-confirm');
    await screen.findByTestId('report-feedback');

    expect(guardador.guardados[0]!.name).toMatch(/^estadisticas-ingles-1y-\d{4}-\d{2}-\d{2}\.pdf$/);
  });
});

describe('Coherencia entre panel y PDF', () => {
  it('las cifras del PDF son literalmente las del panel', async () => {
    const { guardador } = await prepararConReporte();

    await irA('stats-scope-mazo-12');
    const enPantalla = cifra('stats-today-metrics-tarjetas-estudiadas');
    expect(enPantalla).toBe('30');

    await irA('report-open');
    await irA('report-scope-mazo-12');
    await irA('report-confirm');
    await screen.findByTestId('report-feedback');

    const pdf = expectValidPdfStructure(guardador.guardados[0]!.bytes);
    expect(pdf.textRuns).toContain(enPantalla);
  });

  it('el PDF declara desde cuándo hay historial fiable, igual que la pantalla', async () => {
    const { guardador } = await prepararConReporte();
    await generar();

    const pdf = expectValidPdfStructure(guardador.guardados[0]!.bytes);
    expect(pdf.text).toMatch(/Historial de estudio registrado desde .+\./);
  });
});

describe('Fallo al guardar', () => {
  it('se comunica sin romper la pantalla', async () => {
    const repos = repositorios();
    montarApp({
      ...repos,
      initialUrl: '/estadisticas',
      fileSaver: () => ({ status: 'error', message: 'No se ha podido descargar el archivo.' }),
    });
    await screen.findByTestId('stats-scope');

    await generar();

    expect(screen.getByText('No se ha podido descargar el archivo.')).toBeTruthy();
    // La pantalla sigue en pie.
    expect(screen.getByTestId('stats-scope')).toBeTruthy();
  });
});
