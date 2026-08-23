/**
 * Representación común a la que convergen todos los formatos.
 *
 * Un archivo .csv, .xlsx o .md deja de importar en cuanto su parser termina: a partir de ahí
 * el detector, la validación, la vista previa y la escritura trabajan solo sobre estos tipos.
 * Añadir un formato nuevo es escribir un parser más, no otro flujo completo.
 */

/** Una tabla ya normalizada: la primera fila del archivo es `columns`, el resto son `rows`. */
export type ParsedTable = {
  columns: string[];
  /** Cada fila tiene exactamente tantas celdas como `columns`, rellenadas con '' si faltaban. */
  rows: string[][];
  /**
   * De dónde sale cada fila en el archivo original, en paralelo a `rows`.
   *
   * Es la línea del `.csv` o del `.md`, o el número de fila de la hoja de cálculo, siempre
   * empezando en 1. No se puede deducir de la posición dentro de `rows`: si el archivo
   * empieza con líneas en blanco o con una fila de título, el encabezado no está en la
   * primera línea y todo lo demás queda desplazado. Sin esto, decirle a alguien "revisa la
   * fila 4" le manda a mirar una fila que está perfectamente bien.
   *
   * En CSV es el número de registro. Coincide con la línea salvo que un campo entrecomillado
   * contenga saltos de línea, en cuyo caso los registros siguientes quedan desplazados.
   */
  rowLines: number[];
};

export type ParsedSheet = {
  name: string;
  table: ParsedTable;
};

/**
 * Un archivo parseado.
 *
 * CSV y Markdown producen siempre una sola hoja; .xlsx produce una por cada hoja del libro.
 * Unificarlo aquí evita que el resto del sistema tenga que saber de qué formato viene.
 */
export type ParsedWorkbook = {
  sheets: ParsedSheet[];
};

export type ImportErrorCode =
  | 'formato-no-soportado'
  | 'archivo-vacio'
  | 'archivo-ilegible'
  | 'sin-tabla'
  | 'sin-encabezados'
  | 'sin-filas';

export type ParseResult =
  | { ok: true; workbook: ParsedWorkbook }
  | { ok: false; error: ImportErrorCode };

const importErrorMessages: Record<ImportErrorCode, string> = {
  'formato-no-soportado':
    'Ese tipo de archivo todavía no se puede importar. Usa un archivo .csv, .xlsx o .md.',
  'archivo-vacio': 'El archivo está vacío.',
  'archivo-ilegible':
    'No se ha podido leer el archivo. Puede estar dañado o no ser realmente del tipo que indica su nombre.',
  'sin-tabla':
    'Este Markdown no contiene ninguna tabla. Por ahora solo se pueden importar tablas de Markdown con una columna para el frente y otra para el reverso.',
  'sin-encabezados': 'El archivo no tiene una fila de encabezados con la que trabajar.',
  'sin-filas': 'El archivo tiene encabezados pero ninguna fila de datos.',
};

export function importErrorMessage(error: ImportErrorCode): string {
  return importErrorMessages[error];
}

/** Contenido de un archivo elegido, ya leído. El nombre decide qué parser se usa. */
export type PickedFile = {
  name: string;
  bytes: Uint8Array;
};
