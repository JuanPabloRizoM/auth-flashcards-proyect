import type { ParsedTable, ParseResult, ParsedWorkbook } from '../types';

/**
 * Utilidades compartidas por los tres parsers.
 *
 * Todos terminan con la misma pregunta: "tengo una matriz de celdas, ¿qué es una tabla y qué
 * es ruido?". Resolverlo aquí una vez evita que cada formato invente su propia respuesta.
 */

/** Una fila cruda junto al sitio del que viene: la línea del archivo o la fila de la hoja. */
export type SourceRow = {
  cells: readonly string[];
  /** Empezando en 1. Es lo que se le enseñará a la persona usuaria si la fila da problemas. */
  line: number;
};

/** ¿La fila entera está en blanco? */
export function isBlankRow(cells: readonly string[]): boolean {
  return cells.every((cell) => cell.trim().length === 0);
}

/** Numera una matriz correlativamente. Sirve cuando la fila N es literalmente la línea N. */
export function numberRows(matrix: readonly (readonly string[])[], firstLine = 1): SourceRow[] {
  return matrix.map((cells, index) => ({ cells, line: firstLine + index }));
}

/**
 * Convierte filas crudas en una tabla normalizada.
 *
 * La primera fila con algo escrito son los encabezados. Las filas posteriores se recortan o
 * rellenan hasta tener exactamente tantas celdas como encabezados, de modo que el resto del
 * sistema pueda indexar por número de columna sin comprobar longitudes.
 *
 * Cada fila conserva de dónde viene. Las filas en blanco que hay antes de los encabezados se
 * descartan; las que hay en medio se conservan, porque el recuento de filas ignoradas es
 * información que la vista previa muestra.
 */
export function toParsedTable(rows: readonly SourceRow[]): ParseResult {
  const headerIndex = rows.findIndex((row) => !isBlankRow(row.cells));
  if (headerIndex === -1) {
    return { ok: false, error: rows.length === 0 ? 'archivo-vacio' : 'sin-encabezados' };
  }

  const columns = (rows[headerIndex]?.cells ?? []).map((cell) => cell.trim());
  // Un encabezado vacío al final de la fila es habitual (una coma de más, una columna sobrante
  // en Excel). Se recorta la cola para no ofrecer columnas que en realidad no existen.
  while (columns.length > 0 && columns[columns.length - 1] === '') {
    columns.pop();
  }
  if (columns.length === 0) {
    return { ok: false, error: 'sin-encabezados' };
  }

  // Las filas en blanco del final se descartan: casi siempre son el salto de línea con el que
  // termina el archivo, no una fila que alguien haya dejado a medias.
  const body = rows.slice(headerIndex + 1);
  while (body.length > 0 && isBlankRow(body[body.length - 1]?.cells ?? [])) {
    body.pop();
  }
  if (body.length === 0) {
    return { ok: false, error: 'sin-filas' };
  }

  const table: ParsedTable = {
    columns,
    rows: body.map((row) => columns.map((_column, index) => (row.cells[index] ?? '').toString())),
    rowLines: body.map((row) => row.line),
  };

  return { ok: true, workbook: singleSheet('Datos', table) };
}

/** Envuelve una tabla suelta como libro de una sola hoja. CSV y Markdown siempre acaban aquí. */
export function singleSheet(name: string, table: ParsedTable): ParsedWorkbook {
  return { sheets: [{ name, table }] };
}
