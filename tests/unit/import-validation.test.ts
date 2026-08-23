import {
  buildPreview,
  describePreview,
  parseCsv,
  validateMapping,
} from '../../src/features/import';
import type { ParsedTable } from '../../src/features/import/types';
import { fixtureText } from '../fixtures/import/load';

function tablaDe(nombre: string): ParsedTable {
  const result = parseCsv(fixtureText(nombre));
  if (!result.ok) {
    throw new Error(`la fixture ${nombre} debería parsearse, devolvió ${result.error}`);
  }
  return result.workbook.sheets[0]!.table;
}

describe('validateMapping', () => {
  const table: ParsedTable = { columns: ['A', 'B'], rows: [['1', '2']], rowLines: [2] };

  it('acepta dos columnas distintas y existentes', () => {
    expect(validateMapping(table, { front: 0, back: 1 })).toEqual({ ok: true });
  });

  it('exige elegir la columna del frente', () => {
    expect(validateMapping(table, { front: null, back: 1 })).toEqual({
      ok: false,
      error: 'frente-sin-columna',
    });
  });

  it('exige elegir la columna del reverso', () => {
    expect(validateMapping(table, { front: 0, back: null })).toEqual({
      ok: false,
      error: 'reverso-sin-columna',
    });
  });

  it('rechaza que el frente y el reverso sean la misma columna', () => {
    expect(validateMapping(table, { front: 1, back: 1 })).toEqual({
      ok: false,
      error: 'columnas-iguales',
    });
  });

  it('rechaza una columna que no existe en la tabla', () => {
    expect(validateMapping(table, { front: 0, back: 7 })).toEqual({
      ok: false,
      error: 'columna-inexistente',
    });
    expect(validateMapping(table, { front: -1, back: 1 })).toEqual({
      ok: false,
      error: 'columna-inexistente',
    });
  });
});

describe('buildPreview: qué se importaría', () => {
  it('convierte en tarjetas las filas completas', () => {
    const preview = buildPreview(tablaDe('simple.csv'), { front: 0, back: 1 });

    expect(preview.rows).toEqual([
      { front: 'Hello', back: 'Hola' },
      { front: 'House', back: 'Casa' },
      { front: 'Tree', back: 'Arbol' },
    ]);
    expect(preview.rejected).toEqual([]);
    expect(preview.blank).toBe(0);
  });

  it('respeta el mapeo invertido', () => {
    const preview = buildPreview(tablaDe('simple.csv'), { front: 1, back: 0 });

    expect(preview.rows[0]).toEqual({ front: 'Hola', back: 'Hello' });
  });

  it('separa las filas válidas, las que tienen un hueco y las que están en blanco', () => {
    const preview = buildPreview(tablaDe('parcial.csv'), { front: 0, back: 1 });

    expect(preview.rows).toEqual([
      { front: 'Hello', back: 'Hola' },
      { front: 'Bird', back: 'Pájaro' },
    ]);
    expect(preview.blank).toBe(2);
  });

  it('dice en qué fila del archivo está cada problema, contando el encabezado como fila 1', () => {
    const preview = buildPreview(tablaDe('parcial.csv'), { front: 0, back: 1 });

    expect(preview.rejected).toEqual([
      { line: 3, issue: 'frente-vacio' },
      { line: 4, issue: 'reverso-vacio' },
    ]);
  });

  /**
   * Regresión del finding de QA. El número de fila se calculaba como "posición dentro de la
   * tabla + 2", es decir, dando por hecho que el encabezado es la primera línea del archivo.
   * Con líneas en blanco o una fila de título delante, el aviso señalaba una fila que estaba
   * bien, que es peor que no dar ninguna: el único motivo por el que se enseña ese número es
   * que alguien pueda ir a su archivo a arreglar esa fila.
   */
  it('señala la línea real del archivo aunque el encabezado no esté en la primera', () => {
    const table = tablaDe('encabezado-desplazado.csv');
    const preview = buildPreview(table, { front: 0, back: 1 });

    // El encabezado está en la línea 3 y la fila sin frente en la 6.
    expect(preview.rejected).toEqual([{ line: 6, issue: 'frente-vacio' }]);
    expect(preview.rows).toHaveLength(3);
  });

  it('las líneas de las filas válidas también son las del archivo', () => {
    const table = tablaDe('encabezado-desplazado.csv');

    expect(table.rowLines).toEqual([4, 5, 6, 7, 8]);
  });

  it('no devuelve nada mientras falte alguna de las dos columnas', () => {
    const preview = buildPreview(tablaDe('simple.csv'), { front: 0, back: null });

    expect(preview.rows).toEqual([]);
    expect(preview.sample).toEqual([]);
  });

  it('recorta los espacios de cada cara', () => {
    const table: ParsedTable = { columns: ['A', 'B'], rows: [['  hola  ', ' adiós ']], rowLines: [2] };

    expect(buildPreview(table, { front: 0, back: 1 }).rows).toEqual([
      { front: 'hola', back: 'adiós' },
    ]);
  });

  it('enseña solo una muestra de un archivo grande, pero cuenta el total', () => {
    const preview = buildPreview(tablaDe('grande.csv'), { front: 0, back: 1 });

    expect(preview.rows).toHaveLength(125);
    expect(preview.sample).toHaveLength(5);
    expect(preview.sample[0]).toEqual({ front: 'Palabra 1', back: 'Traducción 1' });
  });
});

describe('describePreview: lo que se le dice a la persona usuaria antes de confirmar', () => {
  it('anuncia el total cuando no hay problemas', () => {
    const preview = buildPreview(tablaDe('simple.csv'), { front: 0, back: 1 });

    expect(describePreview(preview)).toBe('Se importarán 3 tarjetas.');
  });

  it('anuncia también cuántas filas se van a descartar', () => {
    const preview = buildPreview(tablaDe('parcial.csv'), { front: 0, back: 1 });

    expect(describePreview(preview)).toBe(
      'Se importarán 2 tarjetas. 2 filas se descartarán por tener el frente o el reverso vacío.',
    );
  });

  it('usa el singular cuando corresponde', () => {
    const table: ParsedTable = { columns: ['A', 'B'], rows: [['uno', 'one']], rowLines: [2] };

    expect(describePreview(buildPreview(table, { front: 0, back: 1 }))).toBe(
      'Se importará 1 tarjeta.',
    );
  });
});
