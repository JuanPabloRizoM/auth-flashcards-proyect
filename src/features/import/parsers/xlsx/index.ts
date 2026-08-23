import { strFromU8, unzipSync } from 'fflate';

import type { ParsedSheet, ParseResult } from '../../types';
import { toParsedTable } from '../table';

import { attribute, columnIndexOf, eachElement, textOf } from './xml';

/**
 * Lector de .xlsx.
 *
 * Un .xlsx es un ZIP con XML dentro. fflate aporta solo el descomprimido; lo que hay que
 * leer después es estrecho: los nombres de las hojas, la tabla de cadenas compartidas y el
 * texto de las celdas. Se lee, nunca se escribe: el archivo de origen no se toca.
 *
 * No se soportan macros ni el formato antiguo .xls, y las fórmulas se leen por su resultado
 * almacenado, que es lo que el archivo trae escrito.
 */

const WORKBOOK = 'xl/workbook.xml';
const WORKBOOK_RELS = 'xl/_rels/workbook.xml.rels';
const SHARED_STRINGS = 'xl/sharedStrings.xml';

export function parseXlsx(bytes: Uint8Array): ParseResult {
  if (bytes.length === 0) {
    return { ok: false, error: 'archivo-vacio' };
  }

  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(bytes);
  } catch {
    // No es un ZIP: un .csv renombrado, una descarga truncada o un archivo dañado.
    return { ok: false, error: 'archivo-ilegible' };
  }

  const workbookXml = readEntry(entries, WORKBOOK);
  if (workbookXml === undefined) {
    // Es un ZIP, pero no un libro de Excel.
    return { ok: false, error: 'archivo-ilegible' };
  }

  const relationships = readRelationships(readEntry(entries, WORKBOOK_RELS) ?? '');
  const sharedStrings = readSharedStrings(readEntry(entries, SHARED_STRINGS) ?? '');

  const sheets: ParsedSheet[] = [];
  for (const descriptor of readSheetDescriptors(workbookXml)) {
    const path = relationships.get(descriptor.relationshipId);
    const sheetXml = path === undefined ? undefined : readEntry(entries, path);
    if (sheetXml === undefined) {
      continue;
    }

    const matrix = readSheetMatrix(sheetXml, sharedStrings);
    const parsed = toParsedTable(matrix);
    // Una hoja sin tabla utilizable (vacía, o solo con una nota suelta) no es un error del
    // libro: simplemente no se ofrece para importar. Es lo que hace que una hoja
    // "Instrucciones" no se cuele como si fuera una colección de tarjetas.
    if (parsed.ok) {
      sheets.push({ name: descriptor.name, table: parsed.workbook.sheets[0]!.table });
    }
  }

  if (sheets.length === 0) {
    return { ok: false, error: 'sin-filas' };
  }

  return { ok: true, workbook: { sheets } };
}

function readEntry(entries: Record<string, Uint8Array>, path: string): string | undefined {
  const bytes = entries[path];
  return bytes === undefined ? undefined : strFromU8(bytes);
}

type SheetDescriptor = { name: string; relationshipId: string };

/** Las hojas, en el orden en que las presenta el libro. */
function readSheetDescriptors(workbookXml: string): SheetDescriptor[] {
  const container = eachElement(workbookXml, 'sheets')[0];
  if (container === undefined) {
    return [];
  }

  return eachElement(container.inner, 'sheet').flatMap((sheet, position) => {
    const relationshipId = attribute(sheet.attributes, 'r:id');
    if (relationshipId === undefined) {
      return [];
    }
    const name = attribute(sheet.attributes, 'name') ?? `Hoja ${position + 1}`;
    return [{ name, relationshipId }];
  });
}

/**
 * Relación `rId` -> ruta dentro del ZIP.
 *
 * El destino puede venir relativo a `xl/` (`worksheets/sheet1.xml`, lo que escribe Excel) o
 * absoluto desde la raíz del paquete (`/xl/worksheets/sheet1.xml`, lo que escriben otras
 * herramientas). Ambas formas son válidas y hay que normalizarlas a la clave del ZIP.
 */
function readRelationships(relsXml: string): Map<string, string> {
  const map = new Map<string, string>();

  for (const relationship of eachElement(relsXml, 'Relationship')) {
    const id = attribute(relationship.attributes, 'Id');
    const target = attribute(relationship.attributes, 'Target');
    if (id === undefined || target === undefined) {
      continue;
    }
    map.set(id, target.startsWith('/') ? target.slice(1) : `xl/${target}`);
  }

  return map;
}

/** Tabla de cadenas compartidas. Excel guarda aquí el texto y en la celda solo su índice. */
function readSharedStrings(sharedStringsXml: string): string[] {
  return eachElement(sharedStringsXml, 'si').map((entry) => textOf(entry.inner));
}

/**
 * Celdas de una hoja como matriz de texto.
 *
 * Las filas se emiten en el orden en que aparecen. Las celdas se colocan por la letra de su
 * referencia, no por su posición entre hermanas, porque una hoja real omite las vacías.
 */
function readSheetMatrix(sheetXml: string, sharedStrings: string[]): string[][] {
  const data = eachElement(sheetXml, 'sheetData')[0];
  if (data === undefined) {
    return [];
  }

  return eachElement(data.inner, 'row').map((row) => {
    const cells: string[] = [];

    for (const [position, cell] of eachElement(row.inner, 'c').entries()) {
      const reference = attribute(cell.attributes, 'r');
      const index = reference === undefined ? position : columnIndexOf(reference) ?? position;

      while (cells.length < index) {
        cells.push('');
      }
      cells[index] = readCellValue(cell.attributes, cell.inner, sharedStrings);
    }

    return cells;
  });
}

/** Texto de una celda según su tipo declarado. Lo que no se reconoce se deja en blanco. */
function readCellValue(attributes: string, inner: string, sharedStrings: string[]): string {
  const type = attribute(attributes, 't') ?? 'n';

  switch (type) {
    case 's': {
      const index = Number(rawValue(inner));
      return Number.isInteger(index) ? sharedStrings[index] ?? '' : '';
    }
    case 'inlineStr':
      return textOf(inner);
    case 'b':
      return rawValue(inner) === '1' ? 'true' : 'false';
    // `str` es el resultado de texto de una fórmula, `e` un error como #N/A, `d` una fecha
    // ISO y `n` un número. En los cuatro casos el archivo ya trae escrito el texto que toca.
    default:
      return rawValue(inner);
  }
}

function rawValue(inner: string): string {
  return eachElement(inner, 'v')[0]?.inner.trim() ?? '';
}
