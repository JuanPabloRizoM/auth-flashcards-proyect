import { render, screen } from '@testing-library/react-native';

import {
  BarChart,
  CalendarHeatmap,
  MetricGrid,
  StatsTable,
  describeCalendarDay,
} from '../../src/components/stats';
import type { CalendarDay } from '../../src/features/stats/engine';
import { chart } from '../../src/theme';

/**
 * Gráficas: accesibilidad y estados vacíos.
 *
 * La exigencia es que la información no dependa solo del color. Se comprueba que cada
 * barra, cada celda del calendario y cada fila anuncian su valor en texto, de modo que una
 * persona que no distinga los tonos, o que no vea la gráfica, obtenga el mismo dato.
 */

describe('Gráfica de barras', () => {
  const puntos = [
    { key: '2026-08-20', label: '20 ago', value: 10, accessibilityLabel: '20 de agosto de 2026: 10 tarjetas.' },
    { key: '2026-08-21', label: '21 ago', value: 20, accessibilityLabel: '21 de agosto de 2026: 20 tarjetas.' },
    { key: '2026-08-22', label: '22 ago', value: 0, accessibilityLabel: '22 de agosto de 2026: 0 tarjetas.' },
  ];

  it('cada barra anuncia su fecha y su valor, no solo su altura', () => {
    render(
      <BarChart
        emptyMessage="sin datos"
        formatPeak={(value) => `${value} tarjetas`}
        points={puntos}
        testID="grafica"
      />,
    );

    expect(screen.getByLabelText('20 de agosto de 2026: 10 tarjetas.')).toBeTruthy();
    expect(screen.getByLabelText('21 de agosto de 2026: 20 tarjetas.')).toBeTruthy();
    // También el día sin actividad: su ausencia es un dato, y se anuncia.
    expect(screen.getByLabelText('22 de agosto de 2026: 0 tarjetas.')).toBeTruthy();
  });

  it('rotula el pico para que la altura tenga referencia numérica', () => {
    render(
      <BarChart
        emptyMessage="sin datos"
        formatPeak={(value) => `${value} tarjetas`}
        points={puntos}
      />,
    );

    expect(screen.getByText('20 tarjetas')).toBeTruthy();
  });

  it('muestra el estado vacío cuando no hay ningún valor, sin dibujar barras a cero', () => {
    render(
      <BarChart
        emptyMessage="Sin tarjetas estudiadas en este periodo."
        formatPeak={String}
        points={[{ key: 'a', label: 'a', value: 0, accessibilityLabel: 'a: 0' }]}
        testID="grafica"
      />,
    );

    expect(screen.getByTestId('grafica-empty')).toBeTruthy();
    expect(screen.getByText('Sin tarjetas estudiadas en este periodo.')).toBeTruthy();
    expect(screen.queryByTestId('grafica')).toBeNull();
  });

  it('sin puntos también muestra el estado vacío', () => {
    render(
      <BarChart emptyMessage="sin datos" formatPeak={String} points={[]} testID="grafica" />,
    );
    expect(screen.getByTestId('grafica-empty')).toBeTruthy();
  });

  it('toma los colores del theme y no declara los suyos', () => {
    // La paleta de gráficas vive en src/theme/tokens.ts, como exige docs/DESIGN.md.
    expect(chart.bar).toBe('#315B7D');
    expect(chart.barAlternate).toBe('#52705A');
    expect(chart.calendarScale).toHaveLength(5);
  });
});

describe('Calendario', () => {
  const dia = (day: string, cards: number, level: CalendarDay['level']): CalendarDay => ({
    day,
    cards,
    activeMs: cards * 30_000,
    sessions: cards > 0 ? 1 : 0,
    level,
  });

  it('cada celda anuncia fecha, tarjetas, tiempo y sesiones', () => {
    render(
      <CalendarHeatmap
        days={[dia('2026-08-23', 42, 4)]}
        emptyMessage="sin datos"
        maxCards={42}
        testID="calendario"
      />,
    );

    expect(
      screen.getByLabelText('23 de agosto de 2026: 42 tarjetas, 21 min, 1 sesión.'),
    ).toBeTruthy();
  });

  it('un día sin actividad lo dice en palabras', () => {
    expect(describeCalendarDay(dia('2026-08-22', 0, 0))).toBe('22 de agosto de 2026: sin actividad.');
  });

  it('la leyenda escribe en texto qué significan los extremos de la escala', () => {
    render(
      <CalendarHeatmap
        days={[dia('2026-08-23', 42, 4)]}
        emptyMessage="sin datos"
        maxCards={42}
        testID="calendario"
      />,
    );

    expect(screen.getByText('Sin actividad')).toBeTruthy();
    expect(screen.getByText('Máximo: 42 tarjetas en un día')).toBeTruthy();
  });

  it('muestra el estado vacío cuando no hay actividad', () => {
    render(
      <CalendarHeatmap
        days={[dia('2026-08-23', 0, 0)]}
        emptyMessage="Sin actividad registrada en este periodo."
        maxCards={0}
        testID="calendario"
      />,
    );

    expect(screen.getByTestId('calendario-empty')).toBeTruthy();
  });
});

describe('Rejilla de cifras', () => {
  it('cada casilla se anuncia con su etiqueta y su valor juntos', () => {
    render(
      <MetricGrid
        metrics={[
          { label: 'Tarjetas estudiadas', value: '44' },
          { label: 'Segundos por tarjeta', value: '—', hint: 'Todavía sin tarjetas hoy' },
        ]}
        testID="cifras"
      />,
    );

    expect(screen.getByLabelText('Tarjetas estudiadas: 44')).toBeTruthy();
    // Lo desconocido se rinde como un guion y se explica, en vez de como un cero.
    expect(screen.getByLabelText('Segundos por tarjeta: —')).toBeTruthy();
    expect(screen.getByText('Todavía sin tarjetas hoy')).toBeTruthy();
  });
});

describe('Tabla de comparación', () => {
  it('cada fila se entiende leída sola, sin haber visto el encabezado', () => {
    render(
      <StatsTable
        columns={[
          { key: 'mazo', header: 'Mazo' },
          { key: 'estudiadas', header: 'Estudiadas', align: 'right' },
        ]}
        emptyMessage="sin datos"
        rows={[
          {
            key: 'mazo-a',
            cells: ['Inglés', '420'],
            accessibilityLabel: 'Inglés: 420 tarjetas estudiadas.',
          },
        ]}
        testID="tabla"
      />,
    );

    expect(screen.getByLabelText('Inglés: 420 tarjetas estudiadas.')).toBeTruthy();
    expect(screen.getByTestId('tabla-fila-mazo-a')).toBeTruthy();
  });

  it('muestra el estado vacío en vez de una tabla sin filas', () => {
    render(
      <StatsTable
        columns={[{ key: 'mazo', header: 'Mazo' }]}
        emptyMessage="Ningún mazo registra actividad en este periodo."
        rows={[]}
        testID="tabla"
      />,
    );

    expect(screen.getByTestId('tabla-empty')).toBeTruthy();
    expect(screen.queryByTestId('tabla')).toBeNull();
  });
});
