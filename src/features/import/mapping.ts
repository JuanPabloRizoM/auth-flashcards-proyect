import type { ParsedTable } from './types';

/**
 * Mapeo de columnas y vista previa.
 *
 * Entre "he parseado un archivo" y "escribo cartas" hay un paso obligatorio: decir qué
 * columna es el Frente y cuál el Reverso, ver el resultado y confirmarlo. Nada de lo que hay
 * aquí escribe nada; solo describe qué se importaría.
 */

/** `null` es "todavía sin elegir", que es distinto de "columna inválida". */
export type FieldMapping = {
  front: number | null;
  back: number | null;
};

export type MappingErrorCode =
  | 'frente-sin-columna'
  | 'reverso-sin-columna'
  | 'columnas-iguales'
  | 'columna-inexistente'
  | 'sin-filas-validas';

const mappingErrorMessages: Record<MappingErrorCode, string> = {
  'frente-sin-columna': 'Elige qué columna contiene el frente de las tarjetas.',
  'reverso-sin-columna': 'Elige qué columna contiene el reverso de las tarjetas.',
  'columnas-iguales':
    'El frente y el reverso no pueden ser la misma columna. Elige dos columnas distintas.',
  'columna-inexistente': 'Esa columna ya no existe en el archivo. Vuelve a elegirla.',
  'sin-filas-validas':
    'Con estas columnas no hay ninguna fila aprovechable: todas tienen el frente o el reverso vacío.',
};

export function mappingErrorMessage(error: MappingErrorCode): string {
  return mappingErrorMessages[error];
}

export type MappingValidation = { ok: true } | { ok: false; error: MappingErrorCode };

/**
 * Comprueba el mapeo antes de dejar importar.
 *
 * Se valida siempre, incluso cuando la detección automática ha rellenado las dos columnas:
 * la detección propone, no autoriza.
 */
export function validateMapping(table: ParsedTable, mapping: FieldMapping): MappingValidation {
  if (mapping.front === null) {
    return { ok: false, error: 'frente-sin-columna' };
  }
  if (mapping.back === null) {
    return { ok: false, error: 'reverso-sin-columna' };
  }
  if (mapping.front === mapping.back) {
    return { ok: false, error: 'columnas-iguales' };
  }
  if (!existsColumn(table, mapping.front) || !existsColumn(table, mapping.back)) {
    return { ok: false, error: 'columna-inexistente' };
  }
  return { ok: true };
}

function existsColumn(table: ParsedTable, index: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < table.columns.length;
}

/** Una carta tal y como se importaría. Todavía no tiene identidad ni mazo. */
export type ImportRow = {
  front: string;
  back: string;
};

/** Por qué una fila no puede convertirse en carta. */
export type RowIssue = 'frente-vacio' | 'reverso-vacio';

export type RejectedRow = {
  /** La línea del archivo, o la fila de la hoja, de la que salió. Empieza en 1. */
  line: number;
  issue: RowIssue;
};

export type ImportPreview = {
  /** Las filas que sí se convertirían en cartas. */
  rows: ImportRow[];
  /** Filas con el frente o el reverso vacío: se cuentan, se muestran y no se importan. */
  rejected: RejectedRow[];
  /** Filas completamente en blanco. No son un problema, simplemente no son nada. */
  blank: number;
  /** Las primeras filas válidas, para enseñar sin volcar el archivo entero en pantalla. */
  sample: ImportRow[];
};

export const PREVIEW_SAMPLE_SIZE = 5;

/**
 * Calcula qué se importaría con este mapeo.
 *
 * Una fila totalmente en blanco no es un error: es una fila de separación, o el final del
 * archivo, y se descarta sin más. Una fila con solo una de las dos caras sí es un problema,
 * porque alguien escribió algo ahí y se va a quedar fuera: por eso se cuenta aparte y se
 * enseña antes de confirmar.
 */
export function buildPreview(
  table: ParsedTable,
  mapping: FieldMapping,
  sampleSize: number = PREVIEW_SAMPLE_SIZE,
): ImportPreview {
  const preview: ImportPreview = { rows: [], rejected: [], blank: 0, sample: [] };

  if (mapping.front === null || mapping.back === null) {
    return preview;
  }

  for (const [index, cells] of table.rows.entries()) {
    // El origen viene del parser. Deducirlo de la posición dentro de `rows` daría un número
    // equivocado en cuanto el archivo no empiece directamente por la fila de encabezados.
    const line = table.rowLines[index] ?? index + 2;
    const front = (cells[mapping.front] ?? '').trim();
    const back = (cells[mapping.back] ?? '').trim();

    if (cells.every((cell) => cell.trim().length === 0)) {
      preview.blank += 1;
      continue;
    }
    if (front.length === 0) {
      preview.rejected.push({ line, issue: 'frente-vacio' });
      continue;
    }
    if (back.length === 0) {
      preview.rejected.push({ line, issue: 'reverso-vacio' });
      continue;
    }

    preview.rows.push({ front, back });
  }

  preview.sample = preview.rows.slice(0, sampleSize);
  return preview;
}

/** Resumen en una frase de lo que va a pasar, para la pantalla. */
export function describePreview(preview: ImportPreview): string {
  const total = preview.rows.length;
  const cards = total === 1 ? 'Se importará 1 tarjeta' : `Se importarán ${total} tarjetas`;

  if (preview.rejected.length === 0) {
    return `${cards}.`;
  }

  const problems =
    preview.rejected.length === 1
      ? '1 fila se descartará por tener el frente o el reverso vacío'
      : `${preview.rejected.length} filas se descartarán por tener el frente o el reverso vacío`;

  return `${cards}. ${problems}.`;
}
