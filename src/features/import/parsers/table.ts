import type { ParsedTable, ParseResult, ParsedWorkbook } from '../types';

/**
 * Utilidades compartidas por los tres parsers.
 *
 * Todos terminan con la misma pregunta: "tengo una matriz de celdas, ¿qué es una tabla y qué
 * es ruido?". Resolverlo aquí una vez evita que cada formato invente su propia respuesta.
 */

/** ¿La fila entera está en blanco? */
export function isBlankRow(cells: readonly string[]): boolean {
  return cells.every((cell) => cell.trim().length === 0);
}

/**
 * Convierte una matriz cruda en una tabla normalizada.
 *
 * La primera fila con algo escrito son los encabezados. Las filas posteriores se recortan o
 * rellenan hasta tener exactamente tantas celdas como encabezados, de modo que el resto del
 * sistema pueda indexar por número de columna sin comprobar longitudes.
 *
 * Las filas en blanco que hay antes de los encabezados se descartan; las que hay después se
 * conservan, porque el recuento de filas ignoradas es información que la vista previa muestra.
 */
export function toParsedTable(matrix: readonly (readonly string[])[]): ParseResult {
  const headerIndex = matrix.findIndex((row) => !isBlankRow(row));
  if (headerIndex === -1) {
    return { ok: false, error: matrix.length === 0 ? 'archivo-vacio' : 'sin-encabezados' };
  }

  const columns = (matrix[headerIndex] ?? []).map((cell) => cell.trim());
  // Un encabezado vacío al final de la fila es habitual (una coma de más, una columna sobrante
  // en Excel). Se recorta la cola para no ofrecer columnas que en realidad no existen.
  while (columns.length > 0 && columns[columns.length - 1] === '') {
    columns.pop();
  }
  if (columns.length === 0) {
    return { ok: false, error: 'sin-encabezados' };
  }

  // Las filas en blanco del final se descartan: casi siempre son el salto de línea con el que
  // termina el archivo, no una fila que alguien haya dejado a medias. Las de en medio sí se
  // conservan, porque forman parte de lo que la vista previa cuenta como ignorado.
  const body = matrix.slice(headerIndex + 1).map((row) => [...row]);
  while (body.length > 0 && isBlankRow(body[body.length - 1] ?? [])) {
    body.pop();
  }
  if (body.length === 0) {
    return { ok: false, error: 'sin-filas' };
  }

  const rows = body.map((row) =>
    columns.map((_column, index) => (row[index] ?? '').toString()),
  );

  return { ok: true, workbook: singleSheet('Datos', { columns, rows }) };
}

/** Envuelve una tabla suelta como libro de una sola hoja. CSV y Markdown siempre acaban aquí. */
export function singleSheet(name: string, table: ParsedTable): ParsedWorkbook {
  return { sheets: [{ name, table }] };
}
