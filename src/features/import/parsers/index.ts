import { strFromU8 } from 'fflate';

import type { ParseResult, PickedFile } from '../types';

import { parseCsv } from './csv';
import { parseMarkdown } from './markdown';
import { parseXlsx } from './xlsx';

/**
 * Punto de entrada de los parsers.
 *
 * Lo único que decide aquí es qué parser usar. A partir de su resultado ya no hay formatos:
 * hay un `ParsedWorkbook` y todo lo demás trabaja sobre él.
 */

export const SUPPORTED_EXTENSIONS = ['.csv', '.xlsx', '.md'] as const;

/** Tipos MIME que ofrecer al selector del sistema, en el mismo orden. */
export const SUPPORTED_MIME_TYPES = [
  'text/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/markdown',
] as const;

export function parsePickedFile(file: PickedFile): ParseResult {
  if (file.bytes.length === 0) {
    return { ok: false, error: 'archivo-vacio' };
  }

  const extension = extensionOf(file.name);

  switch (extension) {
    case '.csv':
      return withDecodedText(file, parseCsv);
    case '.md':
      return withDecodedText(file, parseMarkdown);
    case '.xlsx':
      return parseXlsx(file.bytes);
    default:
      return { ok: false, error: 'formato-no-soportado' };
  }
}

export function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot === -1 ? '' : fileName.slice(dot).toLowerCase();
}

/**
 * Decodifica los bytes como UTF-8 antes de pasárselos a un parser de texto.
 *
 * Se usa `strFromU8` de fflate en vez de `TextDecoder` porque `TextDecoder` no está
 * garantizado en Hermes, y el archivo tiene que leerse igual en las tres plataformas.
 */
function withDecodedText(file: PickedFile, parse: (text: string) => ParseResult): ParseResult {
  let text: string;
  try {
    text = strFromU8(file.bytes);
  } catch {
    return { ok: false, error: 'archivo-ilegible' };
  }
  return parse(text);
}

export { parseCsv } from './csv';
export { parseMarkdown } from './markdown';
export { parseXlsx } from './xlsx';
