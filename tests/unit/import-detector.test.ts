import {
  detectFields,
  headerHeuristicDetector,
  normalizeHeader,
  type FieldDetector,
} from '../../src/features/import';
import type { ParsedTable } from '../../src/features/import/types';

const detectar = (columns: string[]) => headerHeuristicDetector(columns);

describe('normalizeHeader', () => {
  it('recorta los extremos y baja a minúsculas', () => {
    expect(normalizeHeader('  FRONT  ')).toBe('front');
  });

  it('quita los acentos para que "término" y "termino" sean lo mismo', () => {
    expect(normalizeHeader('Término')).toBe(normalizeHeader('termino'));
    expect(normalizeHeader('Definición')).toBe(normalizeHeader('definicion'));
  });

  it('no toca los espacios interiores', () => {
    expect(normalizeHeader('columna  a')).toBe('columna  a');
  });
});

describe('headerHeuristicDetector: candidatos de Frente', () => {
  it.each([
    ['front', 'front'],
    ['frente', 'frente'],
    ['question', 'question'],
    ['pregunta', 'pregunta'],
    ['term', 'term'],
    ['término', 'término con acento'],
    ['termino', 'termino sin acento'],
    ['prompt', 'prompt'],
  ])('reconoce "%s" como Frente (%s)', (header) => {
    expect(detectar([header, 'nada']).front).toBe(0);
  });

  it('no depende de mayúsculas ni de espacios de los extremos', () => {
    expect(detectar(['  FrEnTe  ', 'x']).front).toBe(0);
  });
});

describe('headerHeuristicDetector: candidatos de Reverso', () => {
  it.each([
    ['back', 'back'],
    ['reverso', 'reverso'],
    ['answer', 'answer'],
    ['respuesta', 'respuesta'],
    ['definition', 'definition'],
    ['definición', 'definición con acento'],
    ['definicion', 'definicion sin acento'],
  ])('reconoce "%s" como Reverso (%s)', (header) => {
    expect(detectar(['nada', header]).back).toBe(1);
  });
});

describe('headerHeuristicDetector: parejas completas', () => {
  it.each([
    [['Front', 'Back']],
    [['Frente', 'Reverso']],
    [['Question', 'Answer']],
    [['Pregunta', 'Respuesta']],
    [['Término', 'Definición']],
  ])('preselecciona las dos columnas de %s', (columns) => {
    expect(detectar(columns)).toEqual({ front: 0, back: 1 });
  });

  it('reconoce las columnas aunque vengan al revés en el archivo', () => {
    expect(detectar(['Reverso', 'Frente'])).toEqual({ front: 1, back: 0 });
  });

  it('encuentra las columnas aunque haya otras en medio', () => {
    expect(detectar(['Id', 'Pregunta', 'Notas', 'Respuesta'])).toEqual({ front: 1, back: 3 });
  });
});

describe('headerHeuristicDetector: cuando no hay información suficiente', () => {
  it('no adivina con encabezados desconocidos, ni siquiera con solo dos columnas', () => {
    expect(detectar(['Columna A', 'Columna B'])).toEqual({ front: null, back: null });
  });

  it('deja sin elegir el campo que no reconoce', () => {
    expect(detectar(['Frente', 'Columna B'])).toEqual({ front: 0, back: null });
    expect(detectar(['Columna A', 'Reverso'])).toEqual({ front: null, back: 1 });
  });

  it('no elige nada en una tabla sin encabezados con sentido', () => {
    expect(detectar(['1', '2', '3'])).toEqual({ front: null, back: null });
  });
});

describe('detectFields: el detector es sustituible', () => {
  const table: ParsedTable = { columns: ['Columna A', 'Columna B'], rows: [['a', 'b']], rowLines: [2] };

  it('usa la heurística de encabezados por defecto', () => {
    expect(detectFields(table)).toEqual({ front: null, back: null });
  });

  it('acepta otra estrategia sin tocar el resto del importador', () => {
    // El día que exista otra forma de detectar (por contenido, por ejemplo) se enchufa así,
    // sin reescribir parsers, vista previa ni escritura.
    const porPosicion: FieldDetector = (columns) =>
      columns.length >= 2 ? { front: 0, back: 1 } : { front: null, back: null };

    expect(detectFields(table, porPosicion)).toEqual({ front: 0, back: 1 });
  });
});
