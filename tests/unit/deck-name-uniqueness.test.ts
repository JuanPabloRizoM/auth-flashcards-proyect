import { createDeck, deckNameKey, emptyLibrary } from '../../src/features/decks/library';
import type { Library } from '../../src/types/domain';

function conMazo(name: string): Library {
  const result = createDeck(emptyLibrary, name, 'mazo-1');
  if (!result.ok) throw new Error(`el mazo de partida debería crearse: ${name}`);
  return result.library;
}

describe('deckNameKey: normalización confirmada', () => {
  it('elimina los espacios del principio y del final', () => {
    expect(deckNameKey('  Inglés  ')).toBe(deckNameKey('Inglés'));
  });

  it('no distingue mayúsculas de minúsculas', () => {
    expect(deckNameKey('INGLÉS')).toBe(deckNameKey('inglés'));
  });

  it('combina ambas reglas', () => {
    expect(deckNameKey('  INGLÉS ')).toBe(deckNameKey('inglés'));
  });

  // Estas dos normalizaciones NO están confirmadas y no deben aplicarse.
  it('no colapsa los espacios interiores', () => {
    expect(deckNameKey('Verbos  irregulares')).not.toBe(deckNameKey('Verbos irregulares'));
  });

  it('no elimina los acentos', () => {
    expect(deckNameKey('Inglés')).not.toBe(deckNameKey('Ingles'));
  });
});

describe('unicidad de nombre de mazo, desde la lógica', () => {
  // Esta prueba no monta ninguna pantalla: demuestra que el rechazo vive en el dominio.
  it("rechaza 'Inglés' si ya existe 'INGLÉS'", () => {
    expect(createDeck(conMazo('INGLÉS'), 'Inglés', 'mazo-2')).toEqual({
      ok: false,
      error: 'nombre-duplicado',
    });
  });

  it("rechaza 'Inglés' si ya existe ' Inglés '", () => {
    expect(createDeck(conMazo(' Inglés '), 'Inglés', 'mazo-2')).toEqual({
      ok: false,
      error: 'nombre-duplicado',
    });
  });

  it("rechaza ' inglés ' si ya existe 'Inglés'", () => {
    expect(createDeck(conMazo('Inglés'), ' inglés ', 'mazo-2')).toEqual({
      ok: false,
      error: 'nombre-duplicado',
    });
  });

  it('un intento duplicado no altera la biblioteca', () => {
    const library = conMazo('Inglés');
    const antes = JSON.stringify(library);

    createDeck(library, 'INGLÉS', 'mazo-2');

    expect(JSON.stringify(library)).toBe(antes);
    expect(library.decks).toHaveLength(1);
  });

  it('permite nombres que solo se diferencian en los espacios interiores', () => {
    const result = createDeck(conMazo('Verbos irregulares'), 'Verbos  irregulares', 'mazo-2');

    expect(result.ok).toBe(true);
  });

  it('permite nombres que solo se diferencian en los acentos', () => {
    const result = createDeck(conMazo('Inglés'), 'Ingles', 'mazo-2');

    expect(result.ok).toBe(true);
  });

  it('sigue rechazando el nombre vacío y el de solo espacios', () => {
    expect(createDeck(emptyLibrary, '', 'mazo-1')).toEqual({
      ok: false,
      error: 'nombre-requerido',
    });
    expect(createDeck(emptyLibrary, '     ', 'mazo-1')).toEqual({
      ok: false,
      error: 'nombre-requerido',
    });
  });
});
