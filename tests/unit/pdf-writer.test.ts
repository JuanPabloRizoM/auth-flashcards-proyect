import { A4, createPdfDocument, hexColor, measureText, truncateText } from '../../src/features/stats/pdf/writer';
import { expectValidPdfStructure, readPdf } from '../fixtures/stats/pdfReader';

/**
 * Escritor de PDF.
 *
 * Lo que hay que demostrar es que sale un PDF de verdad y no unos bytes con pinta de PDF:
 * cabecera, objetos, tabla de referencias con desplazamientos que apuntan a donde dicen,
 * y flujos que declaran su longitud real.
 */

describe('Estructura del archivo', () => {
  it('produce un PDF con cabecera mágica, xref coherente y fin de archivo', () => {
    const document = createPdfDocument({ title: 'Prueba' });
    const page = document.addPage();
    page.text(50, 50, 'Hola');

    const pdf = expectValidPdfStructure(document.build());

    expect(pdf.pageCount).toBe(1);
    expect(pdf.text).toContain('Hola');
  });

  it('la cabecera son exactamente los bytes de la firma del formato', () => {
    const bytes = createPdfDocument().build();
    // %PDF-1.4
    expect([...bytes.slice(0, 8)]).toEqual([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
    // Comentario binario, que marca el archivo como no textual.
    expect([...bytes.slice(9, 14)]).toEqual([0x25, 0xe2, 0xe3, 0xcf, 0xd3]);
  });

  it('un documento sin páginas añadidas produce igualmente una página válida', () => {
    const pdf = expectValidPdfStructure(createPdfDocument().build());
    expect(pdf.pageCount).toBe(1);
  });

  it('crece a varias páginas y todas quedan declaradas en el árbol', () => {
    const document = createPdfDocument();
    for (let index = 0; index < 5; index += 1) {
      document.addPage().text(40, 40, `Página ${index + 1}`);
    }

    const pdf = expectValidPdfStructure(document.build());

    expect(document.pageCount).toBe(5);
    expect(pdf.pageCount).toBe(5);
    expect(pdf.raw).toContain('/Kids [6 0 R 8 0 R 10 0 R 12 0 R 14 0 R]');
    expect(pdf.text).toContain('Página 5');
  });

  it('declara el tamaño A4 y las dos fuentes base-14 con codificación WinAnsi', () => {
    const pdf = readPdf(createPdfDocument().build());

    expect(pdf.raw).toContain('/MediaBox [0 0 595.28 841.89]');
    expect(pdf.raw).toContain('/BaseFont /Helvetica /Encoding /WinAnsiEncoding');
    expect(pdf.raw).toContain('/BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding');
    expect(A4.width).toBeCloseTo(595.28);
  });

  it('guarda un título ASCII como literal legible', () => {
    const pdf = readPdf(createPdfDocument({ title: 'Study report' }).build());
    expect(pdf.raw).toContain('/Title (Study report)');
  });

  it('escribe un título con acentos en UTF-16BE, no en bytes de página', () => {
    // Regresión: las cadenas de /Info se leen en PDFDocEncoding, no en WinAnsi. Escribir ahí
    // los mismos bytes que en el contenido hacía que un lector externo mostrara
    // "Reporte de estudio Š Inglés" en el título de la pestaña.
    const pdf = readPdf(createPdfDocument({ title: 'Reporte — Inglés' }).build());

    // FEFF es la marca de orden de bytes; después, un par de bytes por carácter.
    // 'R'=0052, ' '=0020, '—'=2014, 'é'=00E9.
    expect(pdf.raw).toContain('/Title <FEFF0052');
    expect(pdf.raw).toContain('2014');
    expect(pdf.raw).toContain('00E9');
    expect(pdf.raw).not.toContain('/Title (Reporte');
  });
});

describe('Contenido dibujado', () => {
  it('escribe los acentos y la eñe legibles, no como interrogantes', () => {
    const document = createPdfDocument();
    document.addPage().text(40, 40, 'Sesión de estudio en español: ¿añadidas?');

    expect(readPdf(document.build()).text).toContain('Sesión de estudio en español: ¿añadidas?');
  });

  it('escapa los paréntesis y las barras sin romper el flujo', () => {
    const document = createPdfDocument();
    document.addPage().text(40, 40, 'Historia (eliminado) \\ resto');

    const pdf = expectValidPdfStructure(document.build());
    expect(pdf.text).toContain('Historia (eliminado) \\ resto');
  });

  it('los rectángulos rellenos quedan en el flujo: son las barras y el calendario', () => {
    const document = createPdfDocument();
    const page = document.addPage();
    page.rect(10, 10, 20, 40, hexColor('#315B7D'));
    page.rect(40, 10, 20, 80, hexColor('#52705A'));

    const pdf = readPdf(document.build());

    expect(pdf.filledRects).toBe(2);
    expect(pdf.raw).toContain('0.192 0.357 0.49 rg');
  });

  it('un rectángulo sin superficie no se dibuja', () => {
    const document = createPdfDocument();
    const page = document.addPage();
    page.rect(10, 10, 0, 40, hexColor('#000000'));
    page.rect(10, 10, 20, -5, hexColor('#000000'));

    expect(readPdf(document.build()).filledRects).toBe(0);
  });

  it('dibuja líneas para los ejes y los separadores', () => {
    const document = createPdfDocument();
    document.addPage().line(10, 10, 100, 10, hexColor('#DDDAD3'));

    expect(readPdf(document.build()).raw).toContain(' l\nS');
  });

  it('el eje vertical se invierte: y crece hacia abajo en la API y hacia arriba en el archivo', () => {
    const document = createPdfDocument({ height: 800 });
    document.addPage().text(50, 100, 'arriba');

    // 800 - 100 = 700 en coordenadas del formato.
    expect(readPdf(document.build()).raw).toContain('1 0 0 1 50 700 Tm');
  });
});

describe('Medida de texto', () => {
  it('mide el ancho de una cadena a partir de los anchos de glifo', () => {
    // 'iii' son tres glifos de 222 milésimas a 10 puntos: 6.66 puntos.
    expect(measureText('iii', 10)).toBeCloseTo(6.66, 2);
    expect(measureText('WWW', 10)).toBeCloseTo(28.32, 2);
    expect(measureText('', 12)).toBe(0);
  });

  it('escala con el tamaño de fuente', () => {
    expect(measureText('Inglés', 20)).toBeCloseTo(measureText('Inglés', 10) * 2, 5);
  });

  it('recorta lo que no cabe y deja intacto lo que sí', () => {
    expect(truncateText('Inglés', 10, 500)).toBe('Inglés');

    const recortado = truncateText('Vocabulario técnico avanzado de negocios', 10, 60);
    expect(recortado.endsWith('…')).toBe(true);
    expect(measureText(recortado, 10)).toBeLessThanOrEqual(60);
  });
});
