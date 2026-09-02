import { expect, test, type Page } from '@playwright/test';
import { conSesion } from './support/auth';

// Estas pruebas no van de acceso, pero desde TASK-008 la aplicación lo exige: se parte
// de una sesión ya iniciada. El acceso tiene sus propias suites.
test.beforeEach(async ({ page }) => {
  await conSesion(page);
});

/**
 * Estadísticas en un navegador real.
 *
 * Lo que solo puede comprobarse aquí: que la sección se ve y se opera en las tres
 * disposiciones que declara el proyecto, que las gráficas caben sin desbordar a lo ancho, y
 * que el reporte PDF se descarga de verdad como un archivo PDF.
 */

/** Mínimo táctil declarado en src/theme/tokens.ts (sizes.touchTarget). */
const TOUCH_TARGET = 44;

function isMobileProject(projectName: string): boolean {
  return projectName.startsWith('mobile-');
}

async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => {
    const doc = document.documentElement;
    return doc.scrollWidth - doc.clientWidth;
  });
}

/** Crea un mazo con `cartas` tarjetas y lo estudia entero. */
async function crearYEstudiar(page: Page, nombre: string, cartas: number) {
  await page.getByTestId('nav-mazos').click();
  await page.getByTestId('deck-name-input').fill(nombre);
  await page.getByTestId('create-deck-button').click();

  await page.getByRole('button', { name: `Abrir el mazo ${nombre}` }).click();
  await expect(page.getByTestId('add-card-button')).toBeVisible();

  for (let index = 0; index < cartas; index += 1) {
    await page.getByTestId('card-front-input').fill(`${nombre} frente ${index}`);
    await page.getByTestId('card-back-input').fill(`${nombre} reverso ${index}`);
    await page.getByTestId('add-card-button').click();
  }

  await page.getByTestId('study-button').click();
  await expect(page.getByTestId('study-card')).toBeVisible();
  for (let index = 0; index < cartas; index += 1) {
    await page.getByTestId('reveal-button').click();
    // Fácil es la única calificación que saca una tarjeta nueva de la sesión de una vez, de
    // modo que el recorrido termine en un número conocido de pasos.
    await page.getByTestId('rate-easy').click();
  }
  await expect(page.getByTestId('study-finished')).toBeVisible();
}

test.describe('Estadísticas', () => {
  test('la sección es accesible desde la navegación y anuncia su estado activo', async ({
    page,
  }) => {
    await page.goto('/');

    await page.getByTestId('nav-estadisticas').click();

    await expect(page).toHaveURL(/\/estadisticas$/);
    await expect(page.getByRole('heading', { name: 'Estadísticas' })).toBeVisible();
    await expect(page.getByTestId('nav-estadisticas')).toHaveAttribute('aria-current', /.+/);
  });

  test('sin historial muestra el estado vacío en vez de cifras inventadas', async ({ page }) => {
    await page.goto('/estadisticas');

    await expect(page.getByTestId('stats-empty')).toBeVisible();
    await expect(page.getByText('Sin actividad en este periodo')).toBeVisible();

    const texto = (await page.getByTestId('app-scroll').textContent()) ?? '';
    expect(texto).not.toContain('NaN');
    expect(texto).not.toContain('Infinity');
    expect(texto).not.toContain('undefined');
  });

  test('el filtro de mazo y el de periodo cambian lo que se muestra', async ({ page }) => {
    await page.goto('/');
    await crearYEstudiar(page, 'Inglés', 2);
    await crearYEstudiar(page, 'Matemáticas', 3);

    await page.getByTestId('nav-estadisticas').click();
    await expect(page.getByTestId('stats-scope')).toBeVisible();

    const estudiadas = page.getByTestId('stats-today-metrics-tarjetas-estudiadas');
    await expect(estudiadas).toHaveAttribute('aria-label', 'Tarjetas estudiadas: 5');

    await page.getByTestId('stats-scope-mazo-1').click();
    await expect(estudiadas).toHaveAttribute('aria-label', 'Tarjetas estudiadas: 2');
    // Sin comparación de mazos cuando el ámbito es uno solo.
    await expect(page.getByTestId('stats-decks')).toHaveCount(0);

    await page.getByTestId('stats-scope-todos').click();
    await expect(estudiadas).toHaveAttribute('aria-label', 'Tarjetas estudiadas: 5');
    await expect(page.getByTestId('stats-decks')).toBeVisible();

    await page.getByTestId('stats-period-3m').click();
    await expect(
      page.getByTestId('stats-activity-metrics-dias-estudiados'),
    ).toHaveAttribute('aria-label', 'Días estudiados: 1 de 90');
  });

  test('las gráficas se dibujan y son legibles', async ({ page }) => {
    await page.goto('/');
    await crearYEstudiar(page, 'Inglés', 3);

    await page.getByTestId('nav-estadisticas').click();
    await expect(page.getByTestId('stats-activity-chart')).toBeVisible();
    await expect(page.getByTestId('stats-calendar-heatmap')).toBeVisible();
    await expect(page.getByTestId('stats-hourly-chart')).toBeVisible();

    // El pico rotulado da referencia numérica a la altura de las barras.
    await expect(page.getByTestId('stats-activity-chart').getByText('3 tarjetas')).toBeVisible();
    // El calendario explica su escala con palabras, no solo con color.
    await expect(page.getByText('Máximo: 3 tarjetas en un día')).toBeVisible();
    await expect(page.getByText('Sin actividad', { exact: true })).toBeVisible();
  });

  test('la información no depende solo del color', async ({ page }) => {
    await page.goto('/');
    await crearYEstudiar(page, 'Inglés', 2);

    await page.getByTestId('nav-estadisticas').click();
    await expect(page.getByTestId('stats-calendar-heatmap')).toBeVisible();

    // Cada celda del calendario lleva su día, sus tarjetas, su tiempo y sus sesiones.
    const celdas = page.getByTestId('stats-calendar-heatmap').locator('[aria-label]');
    expect(await celdas.count()).toBeGreaterThan(0);
    const etiquetas = await celdas.evaluateAll((nodos) =>
      nodos.map((nodo) => nodo.getAttribute('aria-label') ?? ''),
    );
    expect(etiquetas.some((etiqueta) => /\d+ tarjetas?, .+, \d+ sesi/.test(etiqueta))).toBe(true);
  });

  test('no produce overflow horizontal con datos', async ({ page }) => {
    await page.goto('/');
    await crearYEstudiar(page, 'Inglés', 4);

    await page.getByTestId('nav-estadisticas').click();
    await expect(page.getByTestId('stats-activity-chart')).toBeVisible();

    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  });

  test('los controles son alcanzables con el dedo', async ({ page }, testInfo) => {
    test.skip(!isMobileProject(testInfo.project.name), 'Solo aplica a pantallas táctiles.');

    await page.goto('/estadisticas');
    await expect(page.getByTestId('stats-scope')).toBeVisible();

    const controles = page.locator(
      '#root [role="radio"], #root [role="button"], #root [role="link"]',
    );
    const total = await controles.count();
    expect(total).toBeGreaterThan(0);

    const demasiadoPequenos: string[] = [];
    for (let i = 0; i < total; i += 1) {
      const control = controles.nth(i);
      if (!(await control.isVisible())) continue;
      const caja = await control.boundingBox();
      if (!caja) continue;
      if (caja.height < TOUCH_TARGET || caja.width < TOUCH_TARGET) {
        const texto = (await control.textContent())?.trim() ?? '(sin texto)';
        demasiadoPequenos.push(`${texto}: ${Math.round(caja.width)}x${Math.round(caja.height)}`);
      }
    }

    expect(demasiadoPequenos).toEqual([]);
  });

  test('genera y descarga un reporte PDF real', async ({ page }) => {
    await page.goto('/');
    await crearYEstudiar(page, 'Inglés', 2);

    await page.getByTestId('nav-estadisticas').click();
    await page.getByTestId('report-open').click();
    await expect(page.getByTestId('report-confirm')).toBeVisible();

    const descarga = page.waitForEvent('download');
    await page.getByTestId('report-confirm').click();
    const archivo = await descarga;

    expect(archivo.suggestedFilename()).toMatch(/^estadisticas-.+\.pdf$/);

    // Se comprueba que lo descargado empieza por la firma del formato: un PDF de verdad.
    const ruta = await archivo.path();
    expect(ruta).toBeTruthy();
    const { readFileSync } = await import('node:fs');
    const bytes = readFileSync(ruta!);
    expect(bytes.subarray(0, 8).toString('latin1')).toBe('%PDF-1.4');
    expect(bytes.subarray(-6).toString('latin1').trim()).toBe('%%EOF');

    await expect(page.getByTestId('report-feedback')).toBeVisible();
  });
});
