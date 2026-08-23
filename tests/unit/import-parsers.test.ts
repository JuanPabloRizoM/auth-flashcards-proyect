import { parseCsv, parseMarkdown, parsePickedFile } from '../../src/features/import';
import { fixtureFile, fixtureText } from '../fixtures/import/load';

/**
 * Los parsers se ejercitan contra archivos reales del disco, no contra cadenas escritas
 * dentro del propio test: si se construyera la entrada a mano se estaría comprobando el
 * código contra sus propias suposiciones sobre el formato.
 */

function tablaDe(result: ReturnType<typeof parseCsv>) {
  if (!result.ok) {
    throw new Error(`el parser debería haber funcionado, devolvió ${result.error}`);
  }
  const sheet = result.workbook.sheets[0];
  if (sheet === undefined) {
    throw new Error('debería haber al menos una hoja');
  }
  return sheet.table;
}

describe('parseCsv', () => {
  it('lee un CSV simple con sus encabezados y sus filas', () => {
    const table = tablaDe(parseCsv(fixtureText('simple.csv')));

    expect(table.columns).toEqual(['Front', 'Back']);
    expect(table.rows).toEqual([
      ['Hello', 'Hola'],
      ['House', 'Casa'],
      ['Tree', 'Arbol'],
    ]);
  });

  it('no parte los campos que llevan comas dentro', () => {
    const table = tablaDe(parseCsv(fixtureText('comillas.csv')));

    expect(table.columns).toEqual(['Frente', 'Reverso']);
    expect(table.rows[0]).toEqual(['Hola, ¿cómo estás?', 'Hello, how are you?']);
  });

  it('entiende las comillas escapadas dentro de un campo', () => {
    const table = tablaDe(parseCsv(fixtureText('comillas.csv')));

    expect(table.rows[1]).toEqual(['Dijo "hola"', 'Said "hello"']);
  });

  it('mantiene entero un campo que contiene un salto de línea', () => {
    const table = tablaDe(parseCsv(fixtureText('comillas.csv')));

    expect(table.rows[2]).toEqual(['Dos\nlíneas', 'Two\nlines']);
    // Lo importante: el salto de línea de dentro del campo no ha creado una cuarta fila.
    expect(table.rows).toHaveLength(3);
  });

  it('quita la marca de orden de bytes que escribe Excel', () => {
    const table = tablaDe(parseCsv('﻿Front,Back\nHello,Hola\n'));

    expect(table.columns).toEqual(['Front', 'Back']);
  });

  it('rechaza un archivo vacío', () => {
    expect(parseCsv('')).toEqual({ ok: false, error: 'archivo-vacio' });
  });

  /**
   * Regresión del finding 1 de la revisión. El adivinador de papaparse puntúa por consistencia
   * en el número de campos, y un archivo con punto y coma partido por comas da una columna en
   * todas las filas: consistente, así que la coma ganaba siempre. El resultado era una única
   * columna llamada "Frente;Reverso", imposible de importar porque el frente y el reverso no
   * pueden ser la misma columna. Excel en español exporta así por defecto.
   */
  it('lee un CSV separado por punto y coma, como el que exporta Excel en español', () => {
    const table = tablaDe(parseCsv(fixtureText('punto-y-coma.csv')));

    expect(table.columns).toEqual(['Frente', 'Reverso']);
    expect(table.rows[1]).toEqual(['Casa', 'House']);
  });

  it('con punto y coma sigue respetando los campos entrecomillados', () => {
    const table = tablaDe(parseCsv(fixtureText('punto-y-coma.csv')));

    expect(table.rows[0]).toEqual(['Hola; ¿qué tal?', 'Hi; how are you?']);
  });

  it('lee un CSV separado por tabuladores', () => {
    const table = tablaDe(parseCsv(fixtureText('tabulador.csv')));

    expect(table.columns).toEqual(['Frente', 'Reverso']);
    expect(table.rows).toEqual([
      ['Perro', 'Dog'],
      ['Gato', 'Cat'],
    ]);
  });

  it('no se deja engañar por un separador que solo vive dentro de un campo', () => {
    // La coma es el separador de verdad; el punto y coma solo aparece dentro de un valor.
    const table = tablaDe(parseCsv('"Frente; ojo",Reverso\n"Hola; adiós",Hello\n'));

    expect(table.columns).toEqual(['Frente; ojo', 'Reverso']);
  });

  it('un archivo de una sola columna sigue leyéndose como una sola columna', () => {
    const table = tablaDe(parseCsv('Palabra\nHola\nCasa\n'));

    expect(table.columns).toEqual(['Palabra']);
    expect(table.rows).toEqual([['Hola'], ['Casa']]);
  });

  it('cada fila recuerda de qué línea del archivo viene', () => {
    const table = tablaDe(parseCsv(fixtureText('simple.csv')));

    expect(table.rowLines).toEqual([2, 3, 4]);
  });

  it('rechaza un archivo que solo tiene encabezados', () => {
    expect(parseCsv(fixtureText('solo-encabezados.csv'))).toEqual({
      ok: false,
      error: 'sin-filas',
    });
  });
});

describe('parseMarkdown', () => {
  it('lee una tabla con encabezados Frente y Reverso', () => {
    const table = tablaDe(parseMarkdown(fixtureText('tabla.md')));

    expect(table.columns).toEqual(['Frente', 'Reverso']);
    expect(table.rows).toEqual([
      ['Perro', 'Dog'],
      ['Gato', 'Cat'],
    ]);
  });

  it('encuentra la tabla aunque esté rodeada de prosa, y no se lleva la prosa', () => {
    const table = tablaDe(parseMarkdown(fixtureText('tabla-question.md')));

    expect(table.columns).toEqual(['Question', 'Answer']);
    expect(table.rows).toEqual([
      ['Capital de España', 'Madrid'],
      ['Capital de Italia', 'Roma'],
    ]);
  });

  it('no interpreta como tarjetas un Markdown que no tiene ninguna tabla', () => {
    expect(parseMarkdown(fixtureText('sin-tabla.md'))).toEqual({ ok: false, error: 'sin-tabla' });
  });

  it('no confunde con una tabla una lista con guiones', () => {
    const texto = ['Notas del día', '- primero', '- segundo'].join('\n');

    expect(parseMarkdown(texto)).toEqual({ ok: false, error: 'sin-tabla' });
  });

  it('rechaza una tabla con encabezados pero sin ninguna fila', () => {
    expect(parseMarkdown('| Frente | Reverso |\n|---|---|\n')).toEqual({
      ok: false,
      error: 'sin-filas',
    });
  });

  it('las filas de una tabla que empieza a media página llevan su línea real', () => {
    // En tabla-question.md el encabezado está en la línea 5 y los datos en la 7 y la 8.
    const table = tablaDe(parseMarkdown(fixtureText('tabla-question.md')));

    expect(table.rowLines).toEqual([7, 8]);
  });

  it('respeta un pipe escapado dentro de una celda', () => {
    const table = tablaDe(parseMarkdown('| Frente | Reverso |\n|---|---|\n| a \\| b | c |\n'));

    expect(table.rows[0]).toEqual(['a | b', 'c']);
  });
});

describe('parsePickedFile', () => {
  it('elige el parser por la extensión del archivo', () => {
    const csv = parsePickedFile(fixtureFile('simple.csv'));
    const md = parsePickedFile(fixtureFile('tabla.md'));

    expect(csv.ok && csv.workbook.sheets[0]?.table.columns).toEqual(['Front', 'Back']);
    expect(md.ok && md.workbook.sheets[0]?.table.columns).toEqual(['Frente', 'Reverso']);
  });

  it('rechaza una extensión que no se soporta', () => {
    expect(parsePickedFile({ name: 'apuntes.pdf', bytes: new Uint8Array([1, 2, 3]) })).toEqual({
      ok: false,
      error: 'formato-no-soportado',
    });
  });

  it('rechaza un archivo de cero bytes antes de mirar la extensión', () => {
    expect(parsePickedFile(fixtureFile('vacio.csv'))).toEqual({
      ok: false,
      error: 'archivo-vacio',
    });
  });

  it('lee un CSV grande entero', () => {
    const result = parsePickedFile(fixtureFile('grande.csv'));

    expect(result.ok && result.workbook.sheets[0]?.table.rows).toHaveLength(125);
  });
});
