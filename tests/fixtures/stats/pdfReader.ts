/**
 * Lector de PDF para los tests.
 *
 * Deliberadamente independiente del escritor: no importa nada de `writer.ts` y trabaja
 * sobre los bytes ya producidos, buscando en ellos la estructura que el formato exige. Si
 * compartiera código con el escritor, un fallo común a los dos pasaría desapercibido.
 *
 * Solo entiende el subconjunto que este proyecto genera: objetos sin comprimir y texto en
 * WinAnsi. Es suficiente para afirmar sobre la estructura y sobre lo que el reporte dice.
 */

/** Inverso de la tabla WinAnsi del escritor, para volver a leer los acentos y las comillas. */
const WIN_ANSI_EXTRAS: Record<number, string> = {
  0x80: '€', 0x82: '‚', 0x83: 'ƒ', 0x84: '„', 0x85: '…',
  0x86: '†', 0x87: '‡', 0x88: 'ˆ', 0x89: '‰', 0x8a: 'Š',
  0x8b: '‹', 0x8c: 'Œ', 0x8e: 'Ž', 0x91: '‘', 0x92: '’',
  0x93: '“', 0x94: '”', 0x95: '•', 0x96: '–', 0x97: '—',
  0x98: '˜', 0x99: '™', 0x9a: 'š', 0x9b: '›', 0x9c: 'œ',
  0x9e: 'ž', 0x9f: 'Ÿ',
};

function decode(bytes: Uint8Array): string {
  let text = '';
  for (const byte of bytes) {
    text += WIN_ANSI_EXTRAS[byte] ?? String.fromCharCode(byte);
  }
  return text;
}

export type ReadPdf = {
  /** El archivo entero como texto, para inspeccionar la estructura. */
  raw: string;
  /** `/Count` del árbol de páginas. */
  pageCount: number;
  /** Todo el texto dibujado, en orden, una entrada por operador `Tj`. */
  textRuns: string[];
  /** Todo el texto dibujado unido, para buscar frases. */
  text: string;
  /** Cuántos rectángulos rellenos hay: las barras y las celdas del calendario. */
  filledRects: number;
  /** Desplazamientos declarados en la tabla `xref`, sin el objeto libre. */
  xrefOffsets: number[];
  /** Desplazamiento declarado por `startxref`. */
  startxref: number;
};

export function readPdf(bytes: Uint8Array): ReadPdf {
  const raw = decode(bytes);

  const countMatch = /\/Type\s*\/Pages\s*\/Count\s+(\d+)/.exec(raw);
  const pageCount = countMatch?.[1] ? Number(countMatch[1]) : 0;

  // Texto: cada `(...) Tj` de los flujos de contenido, respetando el escapado.
  const textRuns: string[] = [];
  const textPattern = /\((?:\\.|[^\\()])*\)\s*Tj/g;
  for (const match of raw.matchAll(textPattern)) {
    const literal = match[0].slice(1, match[0].lastIndexOf(')'));
    textRuns.push(literal.replace(/\\([\\()])/g, '$1'));
  }

  const filledRects = [...raw.matchAll(/re\s*\n\s*f/g)].length;

  const xrefBlock = /xref\n0 \d+\n([\s\S]*?)trailer/.exec(raw)?.[1] ?? '';
  const xrefOffsets = [...xrefBlock.matchAll(/^(\d{10}) 00000 n $/gm)].map((match) =>
    Number(match[1]),
  );

  const startxref = Number(/startxref\n(\d+)/.exec(raw)?.[1] ?? -1);

  return {
    raw,
    pageCount,
    textRuns,
    text: textRuns.join('\n'),
    filledRects,
    xrefOffsets,
    startxref,
  };
}

/** Comprobaciones estructurales que todo PDF válido debe cumplir. */
export function expectValidPdfStructure(bytes: Uint8Array): ReadPdf {
  const pdf = readPdf(bytes);

  // Cabecera mágica y comentario binario.
  expect(pdf.raw.startsWith('%PDF-1.4\n')).toBe(true);
  expect(pdf.raw.trimEnd().endsWith('%%EOF')).toBe(true);

  // La tabla xref debe apuntar al principio de un objeto de verdad.
  expect(pdf.xrefOffsets.length).toBeGreaterThan(0);
  for (const [index, offset] of pdf.xrefOffsets.entries()) {
    expect(pdf.raw.slice(offset)).toMatch(new RegExp(`^${index + 1} 0 obj`));
  }

  // `startxref` debe llevar exactamente a la tabla.
  expect(pdf.raw.slice(pdf.startxref, pdf.startxref + 4)).toBe('xref');

  // Catálogo, árbol de páginas y una página por lo menos.
  expect(pdf.raw).toContain('/Type /Catalog');
  expect(pdf.raw).toContain('/Type /Pages');
  expect(pdf.pageCount).toBeGreaterThan(0);
  expect([...pdf.raw.matchAll(/\/Type \/Page[^s]/g)]).toHaveLength(pdf.pageCount);

  // Cada flujo declara su longitud real.
  for (const match of pdf.raw.matchAll(/<< \/Length (\d+) >>\nstream\n/g)) {
    const declared = Number(match[1]);
    const start = match.index! + match[0].length;
    const end = pdf.raw.indexOf('\nendstream', start);
    expect(end - start).toBe(declared);
  }

  return pdf;
}
