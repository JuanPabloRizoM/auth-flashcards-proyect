import type { ParseResult } from '../types';

import { toParsedTable } from './table';

/**
 * Parser de tablas Markdown.
 *
 * El soporte obligatorio de esta tarea se limita a tablas claramente reconocibles: una fila
 * de encabezados, una fila separadora de guiones y las filas de datos. Un documento de prosa
 * no es una colección de flashcards y no se intenta adivinar que lo sea; otros patrones
 * (listas, encabezados de sección, pares pregunta/respuesta separados por líneas) quedan
 * fuera y se rechazan de forma explícita en vez de interpretarse mal.
 */

/** `|---|---|`, `| :--- | ---: |`, con o sin los pipes de los extremos. */
const SEPARATOR = /^\s*\|?\s*:?-{1,}:?\s*(\|\s*:?-{1,}:?\s*)*\|?\s*$/;

export function parseMarkdown(text: string): ParseResult {
  if (text.trim().length === 0) {
    return { ok: false, error: 'archivo-vacio' };
  }

  const lines = text.split(/\r?\n/);

  for (let index = 0; index < lines.length - 1; index += 1) {
    const header = lines[index] ?? '';
    const separator = lines[index + 1] ?? '';

    if (!header.includes('|') || !SEPARATOR.test(separator)) {
      continue;
    }

    const headerCells = splitRow(header);
    if (headerCells.length < 2) {
      continue;
    }
    // Una fila de encabezados y una separadora tienen que hablar del mismo número de columnas.
    // Sin esta comprobación, un guion suelto bajo una línea con un pipe pasaría por tabla.
    if (splitRow(separator).length !== headerCells.length) {
      continue;
    }

    const body: string[][] = [];
    for (let cursor = index + 2; cursor < lines.length; cursor += 1) {
      const line = lines[cursor] ?? '';
      // La tabla termina en la primera línea que ya no es una fila: así el texto que venga
      // después no se cuela como si fueran tarjetas.
      if (!line.includes('|')) {
        break;
      }
      body.push(splitRow(line));
    }

    if (body.length === 0) {
      return { ok: false, error: 'sin-filas' };
    }

    return toParsedTable([headerCells, ...body]);
  }

  return { ok: false, error: 'sin-tabla' };
}

/**
 * Parte una fila por los pipes que separan celdas.
 *
 * `\|` es un pipe escapado dentro de una celda y no separa nada. Los pipes de los extremos
 * son decoración: producen una celda vacía a cada lado que hay que descartar.
 */
function splitRow(line: string): string[] {
  const trimmed = line.trim();
  const cells: string[] = [];
  let current = '';

  for (let index = 0; index < trimmed.length; index += 1) {
    const character = trimmed[index];
    if (character === '\\' && trimmed[index + 1] === '|') {
      current += '|';
      index += 1;
      continue;
    }
    if (character === '|') {
      cells.push(current);
      current = '';
      continue;
    }
    current += character;
  }
  cells.push(current);

  if (trimmed.startsWith('|')) {
    cells.shift();
  }
  if (trimmed.endsWith('|') && !trimmed.endsWith('\\|')) {
    cells.pop();
  }

  return cells.map((cell) => cell.trim());
}
