import type { ParsedTable } from './types';

/**
 * Detección de qué columna es el Frente y cuál el Reverso.
 *
 * Es una capa aparte a propósito. El importador la recibe como parámetro, así que una
 * estrategia distinta se enchufa sin tocar los parsers, la vista previa ni la escritura.
 *
 * ```text
 * FieldDetector
 *  └── headerHeuristicDetector   <- la única implementación de esta tarea
 * ```
 *
 * La heurística mira solo los encabezados y una lista cerrada de sinónimos. Es local,
 * determinista y no consulta ningún servicio: dos ejecuciones sobre el mismo archivo dan
 * siempre el mismo resultado, y por eso puede probarse fila a fila.
 */

/** `null` significa "no lo sé": es la señal de que la persona usuaria tiene que decidirlo. */
export type FieldDetection = {
  front: number | null;
  back: number | null;
};

export type FieldDetector = (columns: readonly string[]) => FieldDetection;

export const FRONT_HEADERS = [
  'front',
  'frente',
  'question',
  'pregunta',
  'term',
  'termino',
  'prompt',
] as const;

export const BACK_HEADERS = [
  'back',
  'reverso',
  'answer',
  'respuesta',
  'definition',
  'definicion',
] as const;

/**
 * Clave de comparación de un encabezado: sin espacios en los extremos, en minúsculas y sin
 * marcas diacríticas.
 *
 * Quitar los acentos es lo que hace que "término" y "termino" o "definición" y "definicion"
 * se traten igual, que es exactamente la diferencia razonable que hay que absorber. Esta
 * normalización es local del importador y no tiene nada que ver con la de nombres de mazo,
 * que sigue siendo solo recortar y bajar a minúsculas.
 */
export function normalizeHeader(header: string): string {
  return header
    .trim()
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Busca cada campo entre los sinónimos conocidos.
 *
 * Si un encabezado no está en la lista no se elige por descarte, aunque solo haya dos
 * columnas: `Columna A | Columna B` no dice cuál es la pregunta, y adivinarlo produciría
 * mazos con el frente y el reverso al revés. En ese caso se devuelve `null` y la interfaz
 * pide que se elija a mano.
 */
export const headerHeuristicDetector: FieldDetector = (columns) => {
  const normalized = columns.map(normalizeHeader);

  const find = (candidates: readonly string[]): number | null => {
    const index = normalized.findIndex((header) => candidates.includes(header));
    return index === -1 ? null : index;
  };

  const front = find(FRONT_HEADERS);
  const back = find(BACK_HEADERS);

  // Las dos listas son disjuntas, así que esto no debería pasar nunca; si un día alguien
  // añade un sinónimo a las dos, es mejor no preseleccionar nada que preseleccionar algo
  // imposible de importar.
  if (front !== null && front === back) {
    return { front: null, back: null };
  }

  return { front, back };
};

/** Detección sobre una tabla concreta. Azúcar para no repetir `table.columns` en cada llamada. */
export function detectFields(
  table: ParsedTable,
  detector: FieldDetector = headerHeuristicDetector,
): FieldDetection {
  return detector(table.columns);
}
