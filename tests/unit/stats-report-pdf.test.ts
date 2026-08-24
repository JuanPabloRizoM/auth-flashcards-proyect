import { buildStatsReport } from '../../src/features/stats/engine';
import { buildStatsPdf, reportFileName } from '../../src/features/stats/pdf/report';
import type { StatsPeriod, StatsQuery } from '../../src/features/stats/types';
import {
  alta,
  biblioteca,
  carta,
  eventos,
  historial,
  mazo,
  resetSequence,
  sesion,
  snapshot,
} from '../fixtures/stats/builders';
import { A4, hexColor, measureText } from '../../src/features/stats/pdf/writer';
import { chart } from '../../src/theme';
import { expectValidPdfStructure } from '../fixtures/stats/pdfReader';

/**
 * Reporte PDF.
 *
 * El reporte se construye a partir de un informe del motor, así que aquí se comprueban dos
 * cosas distintas: que el archivo es un PDF válido y multipágina, y que dice exactamente lo
 * del ámbito y periodo pedidos. El aislamiento por mazo es lo más importante: un reporte de
 * Inglés que se colara con cifras de Matemáticas sería una filtración de datos.
 */

const HOY = '2026-08-23';
/** 23 de agosto de 2026 a mediodía local. */
const GENERADO = new Date(2026, 7, 23, 12, 0, 0).getTime();
/** 1 de agosto de 2026: cuando se activó el tracking en este dispositivo. */
const TRACKED = new Date(2026, 7, 1, 8, 0, 0).getTime();

beforeEach(resetSequence);

/**
 * Cuatro mazos con cifras deliberadamente distinguibles.
 *
 * ```text
 * Inglés         420 tarjetas · 30 s cada una
 * Matemáticas    310 tarjetas
 * Programación   180 tarjetas
 * Historia        90 tarjetas   (mazo ya eliminado, solo historial)
 * ```
 */
function coleccion() {
  const decks = [
    mazo('mazo-ingles', 'Inglés'),
    mazo('mazo-mates', 'Matemáticas'),
    mazo('mazo-prog', 'Programación'),
  ];
  const cards = [
    ...Array.from({ length: 6 }, (_, i) => carta(`ing-${i}`, 'mazo-ingles')),
    ...Array.from({ length: 4 }, (_, i) => carta(`mat-${i}`, 'mazo-mates')),
    ...Array.from({ length: 2 }, (_, i) => carta(`pro-${i}`, 'mazo-prog')),
  ];

  const cardEvents = [
    ...eventos(420, { deckId: 'mazo-ingles', day: '2026-08-20', hour: 9 }),
    ...eventos(310, { deckId: 'mazo-mates', day: '2026-08-21', hour: 17 }),
    ...eventos(180, { deckId: 'mazo-prog', day: '2026-08-22', hour: 22 }),
    ...eventos(90, { deckId: 'mazo-historia', day: '2026-08-19', hour: 7 }),
  ];

  return {
    library: biblioteca(decks, cards),
    history: historial({
      trackedSince: TRACKED,
      cardEvents,
      sessions: [
        sesion({ deckId: 'mazo-ingles', day: '2026-08-20', id: 's-ing' }),
        sesion({ deckId: 'mazo-mates', day: '2026-08-21', id: 's-mat' }),
        sesion({ deckId: 'mazo-prog', day: '2026-08-22', id: 's-pro' }),
        sesion({ deckId: 'mazo-historia', day: '2026-08-19', id: 's-his' }),
      ],
      cardAdditions: [
        alta({ deckId: 'mazo-ingles', cardId: 'ing-0', day: '2026-08-18', origin: 'manual' }),
        alta({ deckId: 'mazo-ingles', cardId: 'ing-1', day: '2026-08-18', origin: 'csv' }),
        alta({ deckId: 'mazo-mates', cardId: 'mat-0', day: '2026-08-19', origin: 'xlsx' }),
        alta({ deckId: 'mazo-prog', cardId: 'pro-0', day: '2026-08-19', origin: 'markdown' }),
      ],
      deckSnapshots: [snapshot('mazo-historia', 'Historia')],
    }),
  };
}

function informe(partes: Partial<StatsQuery> = {}) {
  return buildStatsReport(coleccion(), {
    scope: { kind: 'all' },
    period: 'all',
    today: HOY,
    ...partes,
  });
}

function pdfDe(partes: Partial<StatsQuery> = {}) {
  return expectValidPdfStructure(buildStatsPdf(informe(partes), { generatedAt: GENERADO }));
}

describe('Archivo generado', () => {
  it('es un PDF válido y multipágina', () => {
    const pdf = pdfDe();
    expect(pdf.pageCount).toBeGreaterThan(1);
  });

  it('incluye gráficas: rectángulos rellenos para las barras y el calendario', () => {
    const pdf = pdfDe();
    // Cuatro días con actividad en el calendario, más las barras de cinco gráficas.
    expect(pdf.filledRects).toBeGreaterThan(20);
  });

  it('sugiere un nombre de archivo con el ámbito y el periodo', () => {
    expect(reportFileName(informe({ period: '3m' }))).toBe(
      'estadisticas-todos-los-mazos-3m-2026-08-23.pdf',
    );
    expect(
      reportFileName(informe({ scope: { kind: 'deck', deckId: 'mazo-ingles' }, period: '1y' })),
    ).toBe('estadisticas-ingles-1y-2026-08-23.pdf');
  });
});

describe('Maquetación', () => {
  it('la escala del calendario sale del theme y no de una copia', () => {
    // Regresión: los tonos intermedios estaban escritos a mano en el generador, lo que creaba
    // una segunda fuente de verdad frente a src/theme/tokens.ts (docs/DESIGN.md).
    const { raw } = pdfDe();

    for (const tono of chart.calendarScale) {
      const { r, g, b } = hexColor(tono);
      const formato = (valor: number) =>
        Number.isInteger(valor) ? String(valor) : valor.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
      expect(raw).toContain(`${formato(r)} ${formato(g)} ${formato(b)} rg`);
    }
  });

  it('ninguna etiqueta de cifra se sale del ancho de su columna', () => {
    // Regresión: sin recorte, una etiqueta algo más larga que su columna se metía en la
    // siguiente y el PDF salía técnicamente válido pero visualmente roto.
    const { textRuns } = pdfDe();
    const anchoUtil = (A4.width - 96) / 4 - 10;

    const etiquetas = textRuns.filter((texto) => texto === texto.toUpperCase() && /[A-ZÁÉÍÓÚÑ]/.test(texto));
    expect(etiquetas.length).toBeGreaterThan(10);

    for (const etiqueta of etiquetas) {
      expect(measureText(etiqueta, 7)).toBeLessThanOrEqual(anchoUtil);
    }
  });
});

describe('Portada', () => {
  it('identifica la aplicación, el ámbito, el periodo y la fecha de generación', () => {
    const pdf = pdfDe({ period: '3m' });

    expect(pdf.text).toContain('Flashcards');
    expect(pdf.text).toContain('Reporte de estudio');
    expect(pdf.text).toContain('Todos los mazos');
    expect(pdf.text).toContain('Últimos 3 meses');
    expect(pdf.text).toContain('23 de agosto de 2026');
  });

  it('dice desde cuándo hay historial fiable y que lo anterior no se ha reconstruido', () => {
    const pdf = pdfDe();

    expect(pdf.text).toContain('Historial de estudio registrado desde 1 de agosto de 2026.');
    expect(pdf.text).toContain('Las estadísticas anteriores a esa fecha no existen');
  });

  it('sin tracking activado, lo dice en vez de inventar una fecha', () => {
    const report = buildStatsReport(
      { library: biblioteca(), history: historial({ trackedSince: null }) },
      { scope: { kind: 'all' }, period: 'all', today: HOY },
    );
    const pdf = expectValidPdfStructure(buildStatsPdf(report, { generatedAt: GENERADO }));

    expect(pdf.text).toContain('Historial de estudio todavía no registrado en este dispositivo.');
  });
});

describe('Periodos', () => {
  const casos: readonly [StatsPeriod, string][] = [
    ['1m', 'Último mes'],
    ['3m', 'Últimos 3 meses'],
    ['1y', 'Último año'],
    ['all', 'Todo el historial'],
  ];

  it.each(casos)('el reporte de %s declara "%s"', (period, etiqueta) => {
    expect(pdfDe({ period }).text).toContain(etiqueta);
  });

  it('el periodo cambia de verdad las cifras, no solo la etiqueta', () => {
    // Toda la actividad del dataset está en los últimos días, salvo la de un año atrás.
    const conAntiguo = {
      library: coleccion().library,
      history: historial({
        trackedSince: TRACKED,
        cardEvents: [
          ...eventos(5, { deckId: 'mazo-ingles', day: HOY }),
          ...eventos(7, { deckId: 'mazo-ingles', day: '2025-01-10' }),
        ],
      }),
    };
    const textoDe = (period: StatsPeriod) =>
      expectValidPdfStructure(
        buildStatsPdf(
          buildStatsReport(conAntiguo, { scope: { kind: 'all' }, period, today: HOY }),
          { generatedAt: GENERADO },
        ),
      ).text;

    // 1 mes ve 5; todo ve 12. La cifra aparece en el resumen.
    expect(textoDe('1m')).toContain('Tarjetas estudiadas');
    expect(textoDe('1m').split('\n')).toContain('5');
    expect(textoDe('all').split('\n')).toContain('12');
  });
});

describe('Ámbito de todos los mazos', () => {
  it('lleva la comparación de mazos con los cuatro, incluido el eliminado', () => {
    const pdf = pdfDe();

    expect(pdf.text).toContain('Comparación de mazos');
    expect(pdf.text).toContain('Inglés');
    expect(pdf.text).toContain('Matemáticas');
    expect(pdf.text).toContain('Programación');
    // El mazo eliminado aparece nombrado y marcado; nunca como si siguiera existiendo.
    expect(pdf.text).toContain('Historia (eliminado)');
  });

  it('las cifras de cada mazo son las suyas', () => {
    const lineas = pdfDe().text.split('\n');
    expect(lineas).toContain('420');
    expect(lineas).toContain('310');
    expect(lineas).toContain('180');
    expect(lineas).toContain('90');
    // El total global: 420 + 310 + 180 + 90 = 1000.
    expect(lineas).toContain('1000');
  });
});

describe('Ámbito de un mazo: aislamiento', () => {
  const soloIngles = () => pdfDe({ scope: { kind: 'deck', deckId: 'mazo-ingles' } });

  it('declara el mazo elegido', () => {
    expect(soloIngles().text).toContain('Inglés');
  });

  it('no contiene el nombre de ningún otro mazo', () => {
    const { textRuns } = soloIngles();

    // Se compara contra los textos completos que se dibujan y no contra el archivo entero:
    // "Historia" es además una subcadena de "Historial de estudio registrado desde…", que
    // sí debe aparecer. Lo que no puede aparecer es el mazo Historia como tal.
    for (const otro of ['Matemáticas', 'Programación', 'Historia', 'Historia (eliminado)']) {
      expect(textRuns).not.toContain(otro);
    }
  });

  it('no contiene las cifras exclusivas de los otros mazos', () => {
    const lineas = soloIngles().text.split('\n');

    expect(lineas).toContain('420');
    expect(lineas).not.toContain('310');
    expect(lineas).not.toContain('180');
    expect(lineas).not.toContain('90');
    expect(lineas).not.toContain('1000');
  });

  it('omite la comparación de mazos, que es lo que traería los demás', () => {
    expect(soloIngles().text).not.toContain('Comparación de mazos');
  });

  it('conserva lo estrictamente necesario para identificar la aplicación', () => {
    expect(soloIngles().text).toContain('Flashcards');
    expect(soloIngles().text).toContain('Reporte de estudio');
  });
});

describe('Secciones del reporte', () => {
  it('incluye todas las secciones exigidas', () => {
    const { text } = pdfDe();

    for (const seccion of [
      'Resumen',
      'Tarjetas estudiadas por día',
      'Calendario de actividad',
      'Tiempo de estudio',
      'Velocidad',
      'Conteo de tarjetas',
      'Tarjetas añadidas',
      'Actividad por hora',
      'Origen de las tarjetas',
    ]) {
      expect(text).toContain(seccion);
    }
  });

  it('el resumen lleva las siete cifras pedidas', () => {
    const { text } = pdfDe();

    for (const etiqueta of [
      'TARJETAS ESTUDIADAS',
      'TARJETAS ÚNICAS',
      'TIEMPO DE ESTUDIO',
      'SESIONES',
      'DÍAS ACTIVOS',
      'RACHA ACTUAL',
      'PROMEDIO POR TARJETA',
    ]) {
      expect(text).toContain(etiqueta);
    }
  });

  it('el origen reparte los cuatro formatos y lo anterior al tracking', () => {
    const { text } = pdfDe();

    expect(text).toContain('Manual');
    expect(text).toContain('CSV');
    expect(text).toContain('XLSX');
    expect(text).toContain('Markdown');
    expect(text).toContain('Origen desconocido / anterior al tracking');
  });

  it('declara las métricas de Anki que todavía no pueden calcularse, con su motivo', () => {
    const { text } = pdfDe();

    expect(text).toContain('Métricas todavía no disponibles');
    for (const metrica of [
      'Future Due',
      'Review Intervals',
      'Card Ease',
      'Retention',
      'Answer Buttons',
    ]) {
      expect(text).toContain(metrica);
    }
    expect(text).toContain('Necesita un scheduler');
  });
});

describe('Sin datos', () => {
  const vacio = () =>
    expectValidPdfStructure(
      buildStatsPdf(
        buildStatsReport(
          {
            library: biblioteca([mazo('mazo-a', 'Inglés')], [carta('c-1', 'mazo-a')]),
            history: historial({ trackedSince: TRACKED }),
          },
          { scope: { kind: 'all' }, period: '1m', today: HOY },
        ),
        { generatedAt: GENERADO },
      ),
    );

  it('sigue siendo un PDF válido', () => {
    expect(vacio().pageCount).toBeGreaterThan(0);
  });

  it('dice que no hay actividad en vez de estimarla', () => {
    expect(vacio().text).toContain('No hay actividad de estudio registrada');
    expect(vacio().text).toContain('Sin tarjetas estudiadas en este periodo.');
  });

  it('no escribe NaN, Infinity ni undefined en ninguna parte', () => {
    const { text } = vacio();

    expect(text).not.toContain('NaN');
    expect(text).not.toContain('Infinity');
    expect(text).not.toContain('undefined');
    expect(text).not.toContain('null');
  });

  it('lo desconocido se rinde como un guion, no como un cero', () => {
    // Sin tarjetas completadas no hay promedio por tarjeta que dar.
    expect(vacio().text.split('\n')).toContain('—');
  });
});

describe('Coherencia con el motor', () => {
  it('las cifras del PDF salen del informe, no de un cálculo aparte', () => {
    const report = informe({ scope: { kind: 'deck', deckId: 'mazo-ingles' }, period: 'all' });
    const pdf = expectValidPdfStructure(buildStatsPdf(report, { generatedAt: GENERADO }));
    const lineas = pdf.text.split('\n');

    expect(report.activity.total).toBe(420);
    expect(lineas).toContain('420');
    // 420 tarjetas de 30 s = 12.600 s = 3 h 30 min.
    expect(report.time.totalMs).toBe(12_600_000);
    expect(lineas).toContain('3 h 30 min');
    // 30 s por tarjeta.
    expect(report.speed.averageSeconds).toBe(30);
    expect(lineas).toContain('30.0 s');
  });
});
