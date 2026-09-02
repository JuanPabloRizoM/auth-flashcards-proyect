import { expect, test, type Page } from '@playwright/test';
import { conSesion } from './support/auth';

// Estas pruebas no van de acceso, pero desde TASK-008 la aplicación lo exige: se parte
// de una sesión ya iniciada. El acceso tiene sus propias suites.
test.beforeEach(async ({ page }) => {
  await conSesion(page);
});

/** Mínimo táctil declarado en src/theme/tokens.ts (sizes.touchTarget). */
const TOUCH_TARGET = 44;

const RATINGS = ['rate-again', 'rate-hard', 'rate-good', 'rate-easy'] as const;

function isMobileProject(projectName: string): boolean {
  return projectName.startsWith('mobile-');
}

async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

async function crearMazoConCartas(page: Page, nombre: string, cartas: number) {
  await page.goto('/');
  await page.getByTestId('deck-name-input').fill(nombre);
  await page.getByTestId('create-deck-button').click();
  await page.getByRole('button', { name: `Abrir el mazo ${nombre}` }).click();
  await expect(page.getByTestId('add-card-button')).toBeVisible();

  for (let index = 0; index < cartas; index += 1) {
    await page.getByTestId('card-front-input').fill(`${nombre} frente ${index}`);
    await page.getByTestId('card-back-input').fill(`${nombre} reverso ${index}`);
    await page.getByTestId('add-card-button').click();
  }
}

async function contador(page: Page, clave: 'nuevas' | 'aprendiendo' | 'repasar'): Promise<string> {
  const etiqueta = (await page.getByTestId(`deck-summary-${clave}`).getAttribute('aria-label')) ?? '';
  return etiqueta.slice(etiqueta.indexOf(':') + 1).trim();
}

/**
 * Estudio con repetición espaciada, en un navegador real.
 *
 * El recorrido es el que hace una persona: crear un mazo, ver el resumen, estudiar,
 * calificar, recargar y comprobar que la programación siguió ahí.
 */
test.describe('Estudio con repetición espaciada', () => {
  test('el resumen del mazo cuenta las tarjetas por estado del scheduler', async ({ page }) => {
    await crearMazoConCartas(page, 'Inglés', 3);

    await expect(page.getByTestId('deck-summary')).toBeVisible();
    expect(await contador(page, 'nuevas')).toBe('3');
    expect(await contador(page, 'aprendiendo')).toBe('0');
    expect(await contador(page, 'repasar')).toBe('0');
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  });

  test('el ciclo completo: revelar, calificar y programar la próxima aparición', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });

    await crearMazoConCartas(page, 'Inglés', 2);
    await page.getByTestId('study-button').click();
    await expect(page.getByTestId('study-card')).toBeVisible();

    // Sin respuesta a la vista no hay calificaciones.
    await expect(page.getByTestId('rating-buttons')).toHaveCount(0);

    await page.getByTestId('reveal-button').click();
    await expect(page.getByTestId('rating-buttons')).toBeVisible();

    // Los cuatro botones, en español y con su intervalo real.
    for (const etiqueta of ['Otra vez', 'Difícil', 'Bien', 'Fácil']) {
      await expect(page.getByText(etiqueta, { exact: true })).toBeVisible();
    }
    for (const testId of RATINGS) {
      await expect(page.getByTestId(testId)).toHaveAttribute('aria-label', /Volverá en /);
    }

    // Los intervalos no son todos iguales: salen del preview, no de un literal.
    const intervalos = await Promise.all(
      RATINGS.map(async (testId) => page.getByTestId(testId).getAttribute('aria-label')),
    );
    expect(new Set(intervalos).size).toBe(4);

    await page.getByTestId('rate-easy').click();
    await expect(page.getByText('1 respuesta · 1 pendiente')).toBeVisible();

    await page.getByTestId('reveal-button').click();
    await page.getByTestId('rate-easy').click();
    await expect(page.getByTestId('study-finished')).toBeVisible();

    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    expect(consoleErrors).toEqual([]);
  });

  test('calificar Otra vez devuelve la tarjeta a la cola de la sesión', async ({ page }) => {
    await crearMazoConCartas(page, 'Inglés', 2);
    await page.getByTestId('study-button').click();
    await expect(page.getByTestId('study-front')).toContainText('Inglés frente 0');

    await page.getByTestId('reveal-button').click();
    await page.getByTestId('rate-again').click();
    await expect(page.getByTestId('study-front')).toContainText('Inglés frente 1');

    await page.getByTestId('reveal-button').click();
    await page.getByTestId('rate-easy').click();
    // La primera vuelve: sigue en aprendizaje.
    await expect(page.getByTestId('study-front')).toContainText('Inglés frente 0');
  });

  test('la programación sobrevive a recargar la página', async ({ page }) => {
    await crearMazoConCartas(page, 'Inglés', 2);
    await page.getByTestId('study-button').click();
    await page.getByTestId('reveal-button').click();
    await page.getByTestId('rate-easy').click();
    await page.getByTestId('finish-session-button').click();
    await expect(page.getByTestId('deck-summary')).toBeVisible();

    const nuevasAntes = await contador(page, 'nuevas');
    expect(nuevasAntes).toBe('1');

    await page.reload();
    await expect(page.getByTestId('deck-summary')).toBeVisible();

    expect(await contador(page, 'nuevas')).toBe('1');
    expect(await contador(page, 'repasar')).toBe('0');
  });

  test('siempre se puede terminar la sesión, aunque queden tarjetas', async ({ page }) => {
    await crearMazoConCartas(page, 'Inglés', 3);
    await page.getByTestId('study-button').click();
    await expect(page.getByTestId('finish-session-button')).toBeVisible();

    await page.getByTestId('finish-session-button').click();

    await expect(page).toHaveURL(/\/mazo\/mazo-1$/);
    await expect(page.getByTestId('deck-summary')).toBeVisible();
    // Ninguna tarjeta se ha tocado.
    expect(await contador(page, 'nuevas')).toBe('3');
  });

  test('sin tarjetas que tocar, la sesión lo dice en vez de romperse', async ({ page }) => {
    await crearMazoConCartas(page, 'Inglés', 1);
    await page.getByTestId('study-button').click();
    await page.getByTestId('reveal-button').click();
    await page.getByTestId('rate-easy').click();
    await expect(page.getByTestId('study-finished')).toBeVisible();
    await page.getByTestId('finish-back-button').click();

    await page.getByTestId('study-button').click();

    await expect(page.getByTestId('study-empty')).toBeVisible();
    await expect(page.getByText('Nada que estudiar por ahora')).toBeVisible();
  });

  test('un doble clic sobre una calificación no la aplica dos veces', async ({ page }) => {
    await crearMazoConCartas(page, 'Inglés', 3);
    await page.getByTestId('study-button').click();
    await page.getByTestId('reveal-button').click();

    // Dos pulsaciones sobre el mismo botón, en el mismo tick. Se disparan sobre el nodo
    // directamente y no con `dblclick`: al calificar, la interfaz cambia de alto y un
    // segundo toque por coordenadas caería sobre otro control, que es un accidente de la
    // maquetación y no lo que este test quiere comprobar.
    await page.getByTestId('rate-easy').evaluate((boton: HTMLElement) => {
      boton.click();
      boton.click();
    });

    // Una sola respuesta registrada, no dos: quedan las otras dos tarjetas.
    await expect(page.getByText('1 respuesta · 2 pendientes')).toBeVisible();
    await expect(page.getByText('2 respuestas · 1 pendiente')).toHaveCount(0);
  });

  test('los botones de calificación son alcanzables con el dedo', async ({ page }, testInfo) => {
    test.skip(!isMobileProject(testInfo.project.name), 'Solo aplica a pantallas táctiles.');

    await crearMazoConCartas(page, 'Inglés', 1);
    await page.getByTestId('study-button').click();
    await page.getByTestId('reveal-button').click();
    await expect(page.getByTestId('rating-buttons')).toBeVisible();

    for (const testId of RATINGS) {
      const caja = await page.getByTestId(testId).boundingBox();
      expect(caja).not.toBeNull();
      expect(caja!.height).toBeGreaterThanOrEqual(TOUCH_TARGET);
      expect(caja!.width).toBeGreaterThanOrEqual(TOUCH_TARGET);
    }

    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  });

  test('las estadísticas de calificación aparecen tras estudiar', async ({ page }) => {
    await crearMazoConCartas(page, 'Inglés', 2);
    await page.getByTestId('study-button').click();
    await page.getByTestId('reveal-button').click();
    await page.getByTestId('rate-good').click();
    await page.getByTestId('reveal-button').click();
    await page.getByTestId('rate-easy').click();

    await page.getByTestId('nav-estadisticas').click();
    await expect(page.getByTestId('stats-answer-buttons')).toBeVisible();

    await expect(page.getByTestId('stats-answer-buttons-metrics-bien')).toHaveAttribute(
      'aria-label',
      /Bien: 1/,
    );
    await expect(page.getByTestId('stats-answer-buttons-metrics-facil')).toHaveAttribute(
      'aria-label',
      /Fácil: 1/,
    );
    await expect(page.getByTestId('stats-future-due')).toBeVisible();
    await expect(page.getByTestId('stats-retention')).toBeVisible();
    await expect(page.getByTestId('stats-intervals')).toBeVisible();
    await expect(page.getByTestId('stats-stability')).toBeVisible();
    await expect(page.getByTestId('stats-difficulty')).toBeVisible();
    await expect(page.getByTestId('stats-retrievability')).toBeVisible();

    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  });
});
