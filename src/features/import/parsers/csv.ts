import Papa from 'papaparse';

import type { ParseResult } from '../types';

import { numberRows, toParsedTable } from './table';

/**
 * Parser de CSV.
 *
 * Se apoya en papaparse en lugar de partir por comas: un `split(',')` rompe
 * `"Hola, ¿cómo estás?","Hello, how are you?"` en cuatro campos en vez de dos, y tampoco
 * soporta saltos de línea dentro de un campo entrecomillado ni comillas escapadas. papaparse
 * implementa RFC 4180, así que esos tres casos salen bien sin código propio.
 *
 * Se leen las filas en crudo (`header: false`): quién es el encabezado lo decide
 * `toParsedTable`, igual que en los otros formatos.
 */
export function parseCsv(text: string): ParseResult {
  const withoutBom = stripBom(text);
  if (withoutBom.trim().length === 0) {
    return { ok: false, error: 'archivo-vacio' };
  }

  const parsed = Papa.parse<string[]>(withoutBom, {
    header: false,
    delimiter: guessDelimiter(withoutBom),
    skipEmptyLines: false,
  });

  // papaparse acumula errores por fila y aun así devuelve los datos. Solo se rechaza el
  // archivo si no ha conseguido extraer ninguna fila; un error suelto de comillas en la
  // fila 40 no debe tirar las otras 200.
  if (parsed.data.length === 0) {
    return { ok: false, error: 'archivo-ilegible' };
  }

  // Se numeran los registros que devuelve papaparse. Coinciden con las líneas del archivo
  // salvo que algún campo entrecomillado contenga un salto de línea: entonces ese registro
  // ocupa varias líneas y los siguientes quedan desplazados hacia abajo. Es una desviación
  // conocida y acotada, y sigue siendo mucho mejor referencia que contar desde el encabezado.
  return toParsedTable(numberRows(parsed.data.map((row) => (Array.isArray(row) ? row : []))));
}

/** Los separadores que se consideran, en orden de preferencia ante un empate. */
const DELIMITERS = [',', ';', '\t'] as const;

/**
 * Elige el separador mirando la línea de encabezados.
 *
 * Hay que elegirlo aquí y no dejárselo a papaparse. Su adivinador puntúa por consistencia en
 * el número de campos, y un archivo separado por punto y coma partido por comas produce una
 * sola columna en todas las filas: perfectamente consistente, así que la coma gana siempre y
 * el punto y coma no llega a probarse. Excel en español exporta con punto y coma por defecto,
 * y ese archivo acabaría con una única columna llamada `Frente;Reverso`, imposible de
 * importar porque el frente y el reverso no pueden ser la misma columna.
 *
 * El criterio es el que se puede defender sin adivinar: gana el separador que parta la fila
 * de encabezados en más columnas. Si ninguno la parte, se queda la coma y el archivo se
 * tratará como de una sola columna, que es lo que de verdad es.
 */
function guessDelimiter(text: string): string {
  const headerLine = firstNonEmptyLine(text);

  let best: string = DELIMITERS[0];
  let bestCount = 0;

  for (const delimiter of DELIMITERS) {
    // Se cuenta sobre la fila ya parseada, no con `split`, para que un separador que solo
    // aparece dentro de un campo entrecomillado no sume.
    const [row] = Papa.parse<string[]>(headerLine, { header: false, delimiter }).data;
    const count = Array.isArray(row) ? row.length : 0;
    if (count > bestCount) {
      best = delimiter;
      bestCount = count;
    }
  }

  return best;
}

function firstNonEmptyLine(text: string): string {
  return text.split(/\r?\n/).find((line) => line.trim().length > 0) ?? '';
}

/**
 * Quita la marca de orden de bytes que Excel escribe al exportar a CSV en UTF-8.
 *
 * Sin esto el primer encabezado se llamaría "﻿Front" y el detector no lo reconocería.
 */
function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}
