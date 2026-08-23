import { join } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

/**
 * Importación en el navegador real, con archivos reales.
 *
 * El selector de archivos del sistema se alimenta con el evento `filechooser` de Playwright:
 * el código de producción es exactamente el mismo que usa una persona, incluido
 * expo-document-picker y la lectura del `File` del navegador.
 */

const FIXTURES = join(__dirname, '..', 'fixtures', 'import');

async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

async function crearMazoYAbrirImportacion(page: Page, nombre = 'Vocabulario') {
  await page.goto('/');
  await page.getByTestId('deck-name-input').fill(nombre);
  await page.getByTestId('create-deck-button').click();
  await page.getByTestId('deck-mazo-1').click();
  await page.getByTestId('import-button').click();
  await expect(page.getByTestId('pick-file-button')).toBeVisible();
}

/** Pulsa "Elegir archivo" y entrega la fixture al selector del sistema. */
async function elegirArchivo(page: Page, nombre: string) {
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByTestId('pick-file-button').click(),
  ]);
  await chooser.setFiles(join(FIXTURES, nombre));
}

test.describe('Importar un CSV', () => {
  test('elegir el archivo no importa: primero preview, y solo al confirmar se crean', async ({
    page,
  }) => {
    await crearMazoYAbrirImportacion(page);

    await elegirArchivo(page, 'simple.csv');

    // Los encabezados Front/Back se han reconocido y aun así no hay ninguna carta todavía.
    await expect(page.getByTestId('import-preview')).toBeVisible();
    await expect(page.getByText('Se importarán 3 tarjetas.')).toBeVisible();
    await expect(page.getByTestId('import-result')).toHaveCount(0);

    await page.getByTestId('confirm-import-button').click();
    await expect(page.getByTestId('import-result')).toBeVisible();

    await page.getByTestId('import-done-back').click();
    await expect(page.getByText('Hello')).toBeVisible();
    await expect(page.getByText('Hola')).toBeVisible();
  });

  test('las tarjetas importadas sobreviven a la recarga', async ({ page }) => {
    await crearMazoYAbrirImportacion(page);
    await elegirArchivo(page, 'simple.csv');
    await page.getByTestId('confirm-import-button').click();
    await expect(page.getByTestId('import-result')).toBeVisible();

    await page.goto('/mazo/mazo-1');
    await page.reload();

    await expect(page.getByText('Casa')).toBeVisible();
    await expect(page.getByText('3 cartas')).toBeVisible();
  });

  test('un CSV con comas y comillas dentro de los campos se importa entero', async ({ page }) => {
    await crearMazoYAbrirImportacion(page);

    await elegirArchivo(page, 'comillas.csv');
    await page.getByTestId('confirm-import-button').click();
    await expect(page.getByTestId('import-result')).toBeVisible();
    await page.getByTestId('import-done-back').click();

    await expect(page.getByText('Hola, ¿cómo estás?')).toBeVisible();
    await expect(page.getByText('Hello, how are you?')).toBeVisible();
  });

  test('un archivo grande enseña una muestra y el total, y se importa entero', async ({ page }) => {
    await crearMazoYAbrirImportacion(page);

    await elegirArchivo(page, 'grande.csv');

    await expect(page.getByText('Se importarán 125 tarjetas.')).toBeVisible();
    await expect(page.getByTestId('import-preview-more')).toContainText('120 tarjetas más');
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);

    await page.getByTestId('confirm-import-button').click();
    await expect(page.getByTestId('import-result')).toBeVisible();
    await page.getByTestId('import-done-back').click();

    // El detalle del mazo y su tarjeta en la biblioteca dicen los dos "125 cartas": se ancla
    // la comprobación a la cabecera del mazo para no depender de cuál encuentre primero.
    await expect(page.getByRole('heading', { name: 'Vocabulario' })).toBeVisible();
    await expect(page.getByText('125 cartas', { exact: true })).toBeVisible();
  });
});

test.describe('Cuando los encabezados no dicen nada', () => {
  test('no deja importar hasta que se eligen las columnas a mano', async ({ page }) => {
    await crearMazoYAbrirImportacion(page);

    await elegirArchivo(page, 'desconocido.csv');

    await expect(page.getByTestId('mapping-error')).toBeVisible();
    await expect(page.getByTestId('confirm-import-button')).toHaveCount(0);

    await page.getByTestId('front-select-1').click();
    await page.getByTestId('back-select-0').click();

    // Se ha elegido el mapeo invertido a propósito y se respeta.
    await expect(page.getByTestId('import-preview')).toBeVisible();
    await page.getByTestId('confirm-import-button').click();
    await expect(page.getByTestId('import-result')).toBeVisible();
    await page.getByTestId('import-done-back').click();

    const primera = page.getByTestId('card-carta-2');
    await expect(primera).toContainText('Dog');
    await expect(primera).toContainText('Perro');
  });

  test('la misma columna en las dos caras se rechaza', async ({ page }) => {
    await crearMazoYAbrirImportacion(page);
    await elegirArchivo(page, 'desconocido.csv');

    await page.getByTestId('front-select-0').click();
    await page.getByTestId('back-select-0').click();

    await expect(
      page.getByText('El frente y el reverso no pueden ser la misma columna. Elige dos columnas distintas.'),
    ).toBeVisible();
    await expect(page.getByTestId('confirm-import-button')).toHaveCount(0);
  });
});

test.describe('Importar un .xlsx', () => {
  test('con una sola hoja no pregunta y respeta los acentos', async ({ page }) => {
    await crearMazoYAbrirImportacion(page);

    await elegirArchivo(page, 'basico.xlsx');

    await expect(page.getByTestId('sheet-select')).toHaveCount(0);
    await page.getByTestId('confirm-import-button').click();
    await expect(page.getByTestId('import-result')).toBeVisible();

    await page.goto('/mazo/mazo-1');
    await page.reload();
    await expect(page.getByText('Árbol')).toBeVisible();
  });

  test('con varias hojas se elige la hoja y se importa la elegida', async ({ page }) => {
    await crearMazoYAbrirImportacion(page);

    await elegirArchivo(page, 'multihoja.xlsx');

    await expect(page.getByTestId('sheet-select')).toBeVisible();
    // La hoja "Instrucciones" no tiene tabla y no se ofrece.
    await expect(page.getByTestId('sheet-select')).not.toContainText('Instrucciones');

    await page.getByTestId('sheet-select-1').click();
    await expect(page.getByTestId('mapping-error')).toBeVisible();
    await page.getByTestId('front-select-0').click();
    await page.getByTestId('back-select-1').click();
    await page.getByTestId('confirm-import-button').click();
    await expect(page.getByTestId('import-result')).toBeVisible();

    await page.goto('/mazo/mazo-1');
    await page.reload();
    await expect(page.getByText('Llegada a América')).toBeVisible();
    await expect(page.getByText('Capital de Francia')).toHaveCount(0);
  });
});

test.describe('Importar un Markdown', () => {
  test('una tabla se importa y sobrevive a la recarga', async ({ page }) => {
    await crearMazoYAbrirImportacion(page);

    await elegirArchivo(page, 'tabla.md');
    await expect(page.getByTestId('import-preview')).toBeVisible();
    await page.getByTestId('confirm-import-button').click();
    await expect(page.getByTestId('import-result')).toBeVisible();

    await page.goto('/mazo/mazo-1');
    await page.reload();
    await expect(page.getByText('Perro')).toBeVisible();
    await expect(page.getByText('Cat')).toBeVisible();
  });

  test('un Markdown sin tabla se rechaza y no crea nada', async ({ page }) => {
    await crearMazoYAbrirImportacion(page);

    await elegirArchivo(page, 'sin-tabla.md');

    await expect(page.getByTestId('import-error')).toBeVisible();
    await expect(page.getByTestId('import-preview')).toHaveCount(0);

    await page.goto('/mazo/mazo-1');
    await expect(page.getByTestId('cards-empty')).toBeVisible();
  });
});

test.describe('Archivos y filas problemáticas', () => {
  test('un archivo vacío se rechaza de forma controlada', async ({ page }) => {
    await crearMazoYAbrirImportacion(page);

    await elegirArchivo(page, 'vacio.csv');

    await expect(page.getByText('El archivo está vacío.')).toBeVisible();
  });

  test('un .xlsx dañado se rechaza sin romper la aplicación', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('pageerror', (error) => consoleErrors.push(error.message));

    await crearMazoYAbrirImportacion(page);
    await elegirArchivo(page, 'roto.xlsx');

    await expect(page.getByTestId('import-error')).toBeVisible();
    // La pantalla sigue viva: se puede volver a intentar.
    await expect(page.getByTestId('pick-file-button')).toBeEnabled();
    expect(consoleErrors).toEqual([]);
  });

  test('las filas incompletas se cuentan antes y solo se importan las válidas', async ({ page }) => {
    await crearMazoYAbrirImportacion(page);

    await elegirArchivo(page, 'parcial.csv');

    await expect(
      page.getByText('Se importarán 2 tarjetas. 2 filas se descartarán por tener el frente o el reverso vacío.'),
    ).toBeVisible();
    await expect(page.getByTestId('import-issues')).toContainText('filas 3, 4');

    await page.getByTestId('confirm-import-button').click();
    await expect(page.getByTestId('import-result')).toContainText('Se han importado 2 tarjetas');

    await page.goto('/mazo/mazo-1');
    await page.reload();
    await expect(page.getByText('2 cartas')).toBeVisible();
    await expect(page.getByText('Bird')).toBeVisible();
  });
});

test.describe('El aviso de filas descartadas señala el archivo de verdad', () => {
  /**
   * Regresión del finding de QA. Con líneas en blanco antes del encabezado, el aviso decía
   * "fila 4" cuando la fila con problemas era la 6, y la 4 era una fila perfectamente válida.
   */
  test('con el encabezado desplazado, nombra la línea correcta', async ({ page }) => {
    await crearMazoYAbrirImportacion(page);

    await elegirArchivo(page, 'encabezado-desplazado.csv');

    await expect(page.getByText(/Se importarán 3 tarjetas/)).toBeVisible();
    await expect(page.getByTestId('import-issues')).toContainText('la fila 6');
    await expect(page.getByTestId('import-issues')).not.toContainText('fila 4');

    await page.getByTestId('confirm-import-button').click();
    await expect(page.getByTestId('import-result')).toBeVisible();
    await page.getByTestId('import-done-back').click();

    // Y lo que se importa sigue siendo lo correcto: punto y coma, comillas escapadas y acentos.
    await expect(page.getByText('¿Capital de Francia?')).toBeVisible();
    await expect(page.getByText('Dijo "hola", y se fue')).toBeVisible();
    await expect(page.getByText('Última')).toBeVisible();
  });
});

test.describe('La importación no toca lo que ya había', () => {
  test('las cartas y los mazos existentes siguen igual después de importar', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('deck-name-input').fill('Intacto');
    await page.getByTestId('create-deck-button').click();
    await page.getByTestId('deck-name-input').fill('Vocabulario');
    await page.getByTestId('create-deck-button').click();

    // Una carta a mano en el mazo que no se va a tocar.
    await page.getByTestId('deck-mazo-1').click();
    await page.getByTestId('card-front-input').fill('no me toques');
    await page.getByTestId('card-back-input').fill('sigo aquí');
    await page.getByTestId('add-card-button').click();
    await page.getByTestId('back-to-decks').click();

    await page.getByTestId('deck-mazo-2').click();
    await page.getByTestId('import-button').click();
    await elegirArchivo(page, 'simple.csv');
    await page.getByTestId('confirm-import-button').click();
    await expect(page.getByTestId('import-result')).toBeVisible();

    await page.goto('/mazo/mazo-1');
    await page.reload();
    await expect(page.getByText('no me toques')).toBeVisible();
    await expect(page.getByText('1 carta')).toBeVisible();
    await expect(page.getByText('Hello')).toHaveCount(0);
  });
});
