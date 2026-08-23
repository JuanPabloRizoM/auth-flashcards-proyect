/**
 * Lo mínimo de XML que hace falta para leer un .xlsx.
 *
 * No es un parser de XML de propósito general y no pretende serlo. El XML de una hoja de
 * cálculo lo genera una máquina y tiene una forma muy estrecha: elementos `row`, `c`, `v`,
 * `t` y `si` que no se anidan dentro de sí mismos. Recorrerlos con un escaneo dirigido es
 * suficiente, determinista y comprobable, y evita meter un parser de XML completo en el
 * bundle de una aplicación móvil.
 */

export type XmlElement = {
  /** Los atributos en crudo, tal y como aparecen en la etiqueta de apertura. */
  attributes: string;
  /** El contenido entre la apertura y el cierre. Vacío si el elemento es autocerrado. */
  inner: string;
};

/** Recorre en orden de documento todos los elementos con ese nombre. */
export function eachElement(xml: string, name: string): XmlElement[] {
  const pattern = new RegExp(
    `<${name}(\\s[^>]*?)?(?:/>|>([\\s\\S]*?)</${name}>)`,
    'g',
  );

  const elements: XmlElement[] = [];
  let match = pattern.exec(xml);
  while (match !== null) {
    elements.push({ attributes: match[1] ?? '', inner: match[2] ?? '' });
    match = pattern.exec(xml);
  }
  return elements;
}

/** Valor de un atributo de una etiqueta de apertura, o `undefined` si no está. */
export function attribute(attributes: string, name: string): string | undefined {
  const pattern = new RegExp(`(?:^|\\s)${name.replace(':', '\\:')}\\s*=\\s*"([^"]*)"`);
  const match = pattern.exec(attributes);
  return match?.[1] === undefined ? undefined : decodeEntities(match[1]);
}

/** Texto de todos los `<t>` de un fragmento, concatenado. El texto enriquecido viene troceado. */
export function textOf(xml: string): string {
  return eachElement(xml, 't')
    .map((element) => decodeEntities(element.inner))
    .join('');
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
};

/** Deshace las entidades XML. Sin esto, "Tom & Jerry" se leería como "Tom &amp; Jerry". */
export function decodeEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (whole, body: string) => {
    if (body.startsWith('#x') || body.startsWith('#X')) {
      return codePoint(parseInt(body.slice(2), 16), whole);
    }
    if (body.startsWith('#')) {
      return codePoint(parseInt(body.slice(1), 10), whole);
    }
    return NAMED_ENTITIES[body] ?? whole;
  });
}

/** Una referencia numérica fuera de rango se deja tal cual en vez de reventar la lectura. */
function codePoint(value: number, fallback: string): string {
  if (!Number.isFinite(value) || value < 0 || value > 0x10ffff) {
    return fallback;
  }
  try {
    return String.fromCodePoint(value);
  } catch {
    return fallback;
  }
}

/**
 * Índice de columna a partir de una referencia de celda: `A1` -> 0, `B3` -> 1, `AA1` -> 26.
 *
 * Hay que mirar la referencia y no la posición: una hoja real omite las celdas vacías, así
 * que la tercera `<c>` de una fila puede ser perfectamente la columna F.
 */
export function columnIndexOf(reference: string): number | undefined {
  const match = /^([A-Za-z]+)/.exec(reference);
  const letters = match?.[1];
  if (letters === undefined) {
    return undefined;
  }

  let index = 0;
  for (const letter of letters.toUpperCase()) {
    index = index * 26 + (letter.charCodeAt(0) - 64);
  }
  return index - 1;
}
