/**
 * Escritor de PDF mínimo.
 *
 * Genera un PDF 1.4 real: cabecera, objetos indirectos, catálogo, árbol de páginas, flujos
 * de contenido, tabla `xref` con desplazamientos calculados y `trailer`. Nada de HTML, y
 * nada de una captura vertical del dashboard: se dibuja texto y rectángulos página a
 * página, de modo que el reporte pueda ser multipágina de verdad.
 *
 * **Por qué propio y no una librería.** Este proyecto ya escribe su propio lector de
 * `.xlsx` por la misma razón: lo que hace falta aquí es un subconjunto pequeño y estable
 * del formato (texto en fuentes base-14 y rectángulos rellenos), y las alternativas o
 * pesan mucho más de lo que se usa, o dependen del navegador y no podrían ejercitarse en
 * los tests unitarios, que es justo donde hay que demostrar que el PDF sale bien. Con un
 * escritor propio los tests afirman sobre los bytes de verdad.
 *
 * **Fuentes.** Helvetica y Helvetica-Bold son fuentes base-14: están garantizadas en todo
 * lector y no hay que incrustar nada. Se declaran con `WinAnsiEncoding` para que los
 * acentos y la eñe se rindan bien.
 *
 * El origen de coordenadas del formato está abajo a la izquierda. La API de aquí trabaja
 * desde arriba a la izquierda, que es como se piensa una página, y hace la conversión.
 */

export type PdfColor = { r: number; g: number; b: number };

export type PdfFont = 'regular' | 'bold';

export type TextOptions = {
  size?: number;
  font?: PdfFont;
  color?: PdfColor;
  align?: 'left' | 'right' | 'center';
};

export const A4 = { width: 595.28, height: 841.89 } as const;

/** Anchos de glifo de Helvetica, en milésimas de em. Solo hace falta para alinear. */
const HELVETICA_WIDTHS: Record<string, number> = {
  ' ': 278, '!': 278, '"': 355, '#': 556, $: 556, '%': 889, '&': 667, "'": 191,
  '(': 333, ')': 333, '*': 389, '+': 584, ',': 278, '-': 333, '.': 278, '/': 278,
  '0': 556, '1': 556, '2': 556, '3': 556, '4': 556, '5': 556, '6': 556, '7': 556,
  '8': 556, '9': 556, ':': 278, ';': 278, '<': 584, '=': 584, '>': 584, '?': 556,
  '@': 1015, A: 667, B: 667, C: 722, D: 722, E: 667, F: 611, G: 778, H: 722,
  I: 278, J: 500, K: 667, L: 556, M: 833, N: 722, O: 778, P: 667, Q: 778, R: 722,
  S: 667, T: 611, U: 722, V: 667, W: 944, X: 667, Y: 667, Z: 611,
  '[': 278, '\\': 278, ']': 278, '^': 469, _: 556, '`': 333,
  a: 556, b: 556, c: 500, d: 556, e: 556, f: 278, g: 556, h: 556, i: 222, j: 222,
  k: 500, l: 222, m: 833, n: 556, o: 556, p: 556, q: 556, r: 333, s: 500, t: 278,
  u: 556, v: 500, w: 722, x: 500, y: 500, z: 500,
  '{': 334, '|': 260, '}': 334, '~': 584,
};

const DEFAULT_WIDTH = 556;

/** Ancho de un texto en puntos. Aproximado para los acentos, exacto para ASCII. */
export function measureText(text: string, size: number): number {
  let total = 0;
  for (const char of text) {
    total += HELVETICA_WIDTHS[char] ?? DEFAULT_WIDTH;
  }
  return (total / 1000) * size;
}

/**
 * Recorta un texto a un ancho máximo, con puntos suspensivos.
 *
 * Un nombre de mazo largo no debe salirse de su columna y pisar la siguiente.
 */
export function truncateText(text: string, size: number, maxWidth: number): string {
  if (measureText(text, size) <= maxWidth) return text;
  let cut = text;
  while (cut.length > 1 && measureText(`${cut}…`, size) > maxWidth) {
    cut = cut.slice(0, -1);
  }
  return `${cut}…`;
}

/** Caracteres que WinAnsi coloca fuera del rango de Latin-1. */
const WIN_ANSI_EXTRAS: Record<string, number> = {
  '€': 0x80, '‚': 0x82, 'ƒ': 0x83, '„': 0x84, '…': 0x85,
  '†': 0x86, '‡': 0x87, 'ˆ': 0x88, '‰': 0x89, 'Š': 0x8a,
  '‹': 0x8b, 'Œ': 0x8c, 'Ž': 0x8e, '‘': 0x91, '’': 0x92,
  '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97,
  '˜': 0x98, '™': 0x99, 'š': 0x9a, '›': 0x9b, 'œ': 0x9c,
  'ž': 0x9e, 'Ÿ': 0x9f,
};

/** Convierte a bytes WinAnsi. Lo que no existe en la codificación se sustituye por `?`. */
function encodeWinAnsi(text: string): number[] {
  const bytes: number[] = [];
  for (const char of text) {
    const extra = WIN_ANSI_EXTRAS[char];
    if (extra !== undefined) {
      bytes.push(extra);
      continue;
    }
    const code = char.codePointAt(0) ?? 63;
    bytes.push(code <= 0xff ? code : 63);
  }
  return bytes;
}

/** Escapa lo que un literal de cadena de PDF no admite tal cual. */
function escapePdfText(text: string): string {
  return text.replace(/[\\()]/g, (match) => `\\${match}`);
}

/**
 * Cadena de texto para el diccionario de información del documento.
 *
 * Las cadenas de `/Info` no se leen en WinAnsi como el contenido de página, sino en
 * PDFDocEncoding, donde los bytes altos significan otra cosa: un guion largo salía como `Š`
 * en el título que muestran los lectores. La forma estándar de escribir ahí caracteres fuera
 * de ASCII es UTF-16BE precedido de su marca de orden de bytes, que es lo que se hace aquí.
 *
 * El texto puramente ASCII se deja como literal, que es más legible al inspeccionar el
 * archivo y no necesita conversión.
 */
function pdfInfoString(text: string): string {
  if (/^[\x20-\x7e]*$/.test(text)) {
    return `(${escapePdfText(text)})`;
  }

  let hex = 'FEFF';
  for (const char of text) {
    const code = char.codePointAt(0) ?? 63;
    if (code > 0xffff) {
      // Fuera del plano básico: se escribe el par suplente que exige UTF-16.
      const rest = code - 0x10000;
      hex += (0xd800 + (rest >> 10)).toString(16).padStart(4, '0').toUpperCase();
      hex += (0xdc00 + (rest & 0x3ff)).toString(16).padStart(4, '0').toUpperCase();
      continue;
    }
    hex += code.toString(16).padStart(4, '0').toUpperCase();
  }
  return `<${hex}>`;
}

function formatNumber(value: number): string {
  // Tres decimales bastan de sobra a la escala de una página y evitan notación científica.
  return Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
}

function color(value: PdfColor): string {
  return `${formatNumber(value.r)} ${formatNumber(value.g)} ${formatNumber(value.b)}`;
}

export const BLACK: PdfColor = { r: 0, g: 0, b: 0 };

/** Convierte `#RRGGBB` en el color 0..1 que entiende el formato. */
export function hexColor(hex: string): PdfColor {
  const clean = hex.replace('#', '');
  return {
    r: parseInt(clean.slice(0, 2), 16) / 255,
    g: parseInt(clean.slice(2, 4), 16) / 255,
    b: parseInt(clean.slice(4, 6), 16) / 255,
  };
}

export type PdfPage = {
  /** Texto con el origen arriba a la izquierda; `y` es la línea base. */
  text: (x: number, y: number, value: string, options?: TextOptions) => void;
  /** Rectángulo relleno. Es lo que dibuja las barras y las celdas del calendario. */
  rect: (x: number, y: number, width: number, height: number, fill: PdfColor) => void;
  /** Línea de 1 punto, para ejes y separadores. */
  line: (x1: number, y1: number, x2: number, y2: number, stroke: PdfColor, width?: number) => void;
  readonly width: number;
  readonly height: number;
};

export type PdfDocument = {
  addPage: () => PdfPage;
  readonly pageCount: number;
  /** Los bytes del archivo, listos para descargar o escribir. */
  build: () => Uint8Array;
};

export type PdfDocumentOptions = {
  title?: string;
  width?: number;
  height?: number;
};

export function createPdfDocument(options: PdfDocumentOptions = {}): PdfDocument {
  const width = options.width ?? A4.width;
  const height = options.height ?? A4.height;
  const pages: string[][] = [];

  const addPage = (): PdfPage => {
    const ops: string[] = [];
    pages.push(ops);

    const page: PdfPage = {
      width,
      height,
      text(x, y, value, textOptions = {}) {
        const size = textOptions.size ?? 10;
        const font = textOptions.font === 'bold' ? '/F2' : '/F1';
        const fill = textOptions.color ?? BLACK;
        const measured = measureText(value, size);
        const offset =
          textOptions.align === 'right'
            ? -measured
            : textOptions.align === 'center'
              ? -measured / 2
              : 0;
        ops.push(
          'BT',
          `${color(fill)} rg`,
          `${font} ${formatNumber(size)} Tf`,
          `1 0 0 1 ${formatNumber(x + offset)} ${formatNumber(height - y)} Tm`,
          `(${escapePdfText(value)}) Tj`,
          'ET',
        );
      },
      rect(x, y, rectWidth, rectHeight, fill) {
        if (rectWidth <= 0 || rectHeight <= 0) return;
        ops.push(
          'q',
          `${color(fill)} rg`,
          `${formatNumber(x)} ${formatNumber(height - y - rectHeight)} ${formatNumber(rectWidth)} ${formatNumber(rectHeight)} re`,
          'f',
          'Q',
        );
      },
      line(x1, y1, x2, y2, stroke, lineWidth = 0.75) {
        ops.push(
          'q',
          `${color(stroke)} RG`,
          `${formatNumber(lineWidth)} w`,
          `${formatNumber(x1)} ${formatNumber(height - y1)} m`,
          `${formatNumber(x2)} ${formatNumber(height - y2)} l`,
          'S',
          'Q',
        );
      },
    };

    return page;
  };

  const build = (): Uint8Array => {
    if (pages.length === 0) addPage();

    const bytes: number[] = [];
    const push = (text: string) => {
      for (const code of encodeWinAnsi(text)) bytes.push(code);
    };
    const pushRaw = (raw: number[]) => {
      for (const code of raw) bytes.push(code);
    };

    // Objetos: 1 catálogo, 2 páginas, 3 y 4 fuentes, 5 información del documento, y a
    // partir de 6 una página y su flujo de contenido por cada página.
    const infoObject = 5;
    const firstPageObject = 6;
    const pageObjectIds = pages.map((_, index) => firstPageObject + index * 2);
    const contentObjectIds = pageObjectIds.map((id) => id + 1);
    const totalObjects = 5 + pages.length * 2;

    const offsets = new Array<number>(totalObjects + 1).fill(0);
    const beginObject = (id: number) => {
      offsets[id] = bytes.length;
      push(`${id} 0 obj\n`);
    };
    const endObject = () => push('endobj\n');

    push('%PDF-1.4\n');
    // Comentario binario: le dice a cualquier herramienta que el archivo no es de texto.
    pushRaw([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]);

    beginObject(1);
    push('<< /Type /Catalog /Pages 2 0 R >>\n');
    endObject();

    beginObject(2);
    push(
      `<< /Type /Pages /Count ${pages.length} /Kids [${pageObjectIds
        .map((id) => `${id} 0 R`)
        .join(' ')}] >>\n`,
    );
    endObject();

    beginObject(3);
    push(
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\n',
    );
    endObject();

    beginObject(4);
    push(
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\n',
    );
    endObject();

    beginObject(infoObject);
    const title = options.title ?? 'Reporte de estudio';
    push(`<< /Title ${pdfInfoString(title)} /Producer (Flashcards) >>\n`);
    endObject();

    pages.forEach((ops, index) => {
      const pageId = pageObjectIds[index]!;
      const contentId = contentObjectIds[index]!;

      beginObject(pageId);
      push(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${formatNumber(width)} ${formatNumber(height)}] ` +
          `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>\n`,
      );
      endObject();

      const stream = ops.join('\n');
      const streamBytes = encodeWinAnsi(stream);
      beginObject(contentId);
      push(`<< /Length ${streamBytes.length} >>\nstream\n`);
      pushRaw(streamBytes);
      push('\nendstream\n');
      endObject();
    });

    const xrefOffset = bytes.length;
    push(`xref\n0 ${totalObjects + 1}\n`);
    push('0000000000 65535 f \n');
    for (let id = 1; id <= totalObjects; id += 1) {
      push(`${String(offsets[id] ?? 0).padStart(10, '0')} 00000 n \n`);
    }

    push(
      `trailer\n<< /Size ${totalObjects + 1} /Root 1 0 R /Info ${infoObject} 0 R >>\n`,
    );
    push(`startxref\n${xrefOffset}\n%%EOF\n`);

    return Uint8Array.from(bytes);
  };

  return {
    addPage,
    get pageCount() {
      return pages.length;
    },
    build,
  };
}
