import { parsePickedFile, parseXlsx } from '../../src/features/import';
import type { ParsedSheet } from '../../src/features/import/types';
import { fixtureBytes, fixtureFile } from '../fixtures/import/load';

/**
 * Las fixtures .xlsx las escriben dos herramientas distintas a propósito. openpyxl guarda el
 * texto dentro de la propia celda y XlsxWriter lo guarda en una tabla de cadenas compartidas;
 * un lector que solo entendiera una de las dos formas fallaría con la mitad de los archivos
 * reales. Ver tests/fixtures/import/README.md.
 */

function hojas(result: ReturnType<typeof parseXlsx>): ParsedSheet[] {
  if (!result.ok) {
    throw new Error(`el libro debería leerse, devolvió ${result.error}`);
  }
  return result.workbook.sheets;
}

describe('parseXlsx: libro escrito con cadenas en línea', () => {
  it('lee la única hoja con sus encabezados y sus filas', () => {
    const [sheet, ...resto] = hojas(parseXlsx(fixtureBytes('basico.xlsx')));

    expect(resto).toHaveLength(0);
    expect(sheet?.name).toBe('Vocabulario');
    expect(sheet?.table.columns).toEqual(['Front', 'Back']);
    expect(sheet?.table.rows).toEqual([
      ['Hello', 'Hola'],
      ['House', 'Casa'],
      ['Tree', 'Árbol'],
    ]);
  });
});

describe('parseXlsx: libro con tabla de cadenas compartidas', () => {
  it('resuelve el texto a través de la tabla compartida', () => {
    const [sheet] = hojas(parseXlsx(fixtureBytes('compartidas.xlsx')));

    expect(sheet?.name).toBe('Términos');
    expect(sheet?.table.columns).toEqual(['Término', 'Definición']);
    expect(sheet?.table.rows[0]).toEqual(['Ñandú', 'Ave corredora sudamericana']);
    expect(sheet?.table.rows[2]).toEqual(['Árbol', 'Planta perenne de tronco leñoso']);
  });

  it('deshace las entidades XML del contenido', () => {
    const [sheet] = hojas(parseXlsx(fixtureBytes('compartidas.xlsx')));

    // En el XML esto está guardado como "Tom &amp; Jerry" y "Dibujos &lt;animados&gt;".
    expect(sheet?.table.rows[1]).toEqual(['Tom & Jerry', 'Dibujos <animados>']);
  });
});

describe('parseXlsx: libro con varias hojas', () => {
  it('devuelve las hojas con datos, en el orden del libro', () => {
    const sheets = hojas(parseXlsx(fixtureBytes('multihoja.xlsx')));

    expect(sheets.map((sheet) => sheet.name)).toEqual(['Inglés', 'Historia']);
  });

  it('deja fuera la hoja que no contiene una tabla', () => {
    const sheets = hojas(parseXlsx(fixtureBytes('multihoja.xlsx')));

    // "Instrucciones" solo tiene una frase suelta: no es una colección de tarjetas y no se
    // ofrece para importar.
    expect(sheets.map((sheet) => sheet.name)).not.toContain('Instrucciones');
  });

  it('cada hoja conserva sus propios encabezados', () => {
    const [ingles, historia] = hojas(parseXlsx(fixtureBytes('multihoja.xlsx')));

    expect(ingles?.table.columns).toEqual(['Question', 'Answer']);
    expect(historia?.table.columns).toEqual(['Columna A', 'Columna B']);
    expect(historia?.table.rows).toEqual([
      ['1492', 'Llegada a América'],
      ['1789', 'Revolución francesa'],
    ]);
  });
});

describe('parseXlsx: archivos que no valen', () => {
  it('rechaza un archivo truncado que no llega a ser un ZIP', () => {
    expect(parseXlsx(fixtureBytes('roto.xlsx'))).toEqual({ ok: false, error: 'archivo-ilegible' });
  });

  it('rechaza un archivo vacío', () => {
    expect(parseXlsx(new Uint8Array())).toEqual({ ok: false, error: 'archivo-vacio' });
  });

  it('rechaza un .csv al que solo se le ha cambiado la extensión', () => {
    const disfrazado = { name: 'trampa.xlsx', bytes: fixtureBytes('simple.csv') };

    expect(parsePickedFile(disfrazado)).toEqual({ ok: false, error: 'archivo-ilegible' });
  });

  it('no rompe la aplicación al leer un .xlsx dañado elegido por la persona usuaria', () => {
    expect(() => parsePickedFile(fixtureFile('roto.xlsx'))).not.toThrow();
  });
});
