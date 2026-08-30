import { expect, test, type Page } from '@playwright/test';

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

async function crearMazo(page: Page, nombre: string) {
  await page.getByTestId('deck-name-input').fill(nombre);
  await page.getByTestId('create-deck-button').click();
}

async function anadirCarta(page: Page, frente: string, reverso: string) {
  await page.getByTestId('card-front-input').fill(frente);
  await page.getByTestId('card-back-input').fill(reverso);
  await page.getByTestId('add-card-button').click();
}

test.describe('Recorrido completo: mazo, cartas y estudio', () => {
  test('crear un mazo, añadirle cartas y estudiarlas', async ({ page }, testInfo) => {
    const consoleErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') {
        consoleErrors.push(message.text());
      }
    });

    // 1. Estado inicial: sin mazos.
    await page.goto('/');
    await expect(page.getByTestId('decks-empty')).toBeVisible();

    // 2. Crear un mazo: aparece en la lista sin recargar.
    await crearMazo(page, 'Inglés');
    await expect(page.getByTestId('decks-list')).toBeVisible();
    await expect(page.getByTestId('deck-mazo-1')).toContainText('Inglés');
    await expect(page.getByTestId('decks-empty')).toHaveCount(0);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);

    // 3. Entrar al detalle del mazo.
    await page.getByTestId('deck-mazo-1').click();
    await expect(page).toHaveURL(/\/mazo\/mazo-1$/);
    await expect(page.getByRole('heading', { name: 'Inglés' })).toBeVisible();
    await expect(page.getByTestId('cards-empty')).toBeVisible();
    // Sin cartas no se puede estudiar, y el control lo comunica.
    await expect(page.getByTestId('study-button')).toBeDisabled();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);

    // 4. Crear dos cartas.
    await anadirCarta(page, 'to overlook', 'pasar por alto');
    await expect(page.getByTestId('cards-list')).toBeVisible();
    await expect(page.getByText('to overlook')).toBeVisible();
    await expect(page.getByText('pasar por alto')).toBeVisible();
    await expect(page.getByTestId('card-front-input')).toHaveValue('');

    await anadirCarta(page, 'to withstand', 'resistir');
    await expect(page.getByText('to withstand')).toBeVisible();
    await expect(page.getByTestId('study-button')).toBeEnabled();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);

    // 5. Estudiar: primero solo el frente.
    await page.getByTestId('study-button').click();
    await expect(page).toHaveURL(/\/mazo\/mazo-1\/estudiar$/);
    await expect(page.getByTestId('study-front')).toContainText('to overlook');
    await expect(page.getByTestId('study-back')).toHaveCount(0);
    await expect(page.getByText('2 tarjetas por delante')).toBeVisible();
    // Sin respuesta a la vista no hay nada que calificar.
    await expect(page.getByTestId('rating-buttons')).toHaveCount(0);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);

    // 6. Mostrar respuesta: frente, reverso y las cuatro calificaciones.
    await page.getByTestId('reveal-button').click();
    await expect(page.getByTestId('study-front')).toContainText('to overlook');
    await expect(page.getByTestId('study-back')).toContainText('pasar por alto');
    await expect(page.getByTestId('reveal-button')).toHaveCount(0);
    await expect(page.getByTestId('rating-buttons')).toBeVisible();

    // 7. Calificar: la siguiente tarjeta vuelve a mostrarse solo por el frente.
    await page.getByTestId('rate-easy').click();
    await expect(page.getByTestId('study-front')).toContainText('to withstand');
    await expect(page.getByTestId('study-back')).toHaveCount(0);
    await expect(page.getByText('1 respuesta · 1 pendiente')).toBeVisible();

    // 8. Terminar la sesión.
    await page.getByTestId('reveal-button').click();
    await expect(page.getByTestId('study-back')).toContainText('resistir');
    await page.getByTestId('rate-easy').click();
    await expect(page.getByTestId('study-finished')).toBeVisible();
    await expect(page.getByText('Sesión terminada')).toBeVisible();

    // 9. Volver al mazo desde el final de la sesión.
    await page.getByTestId('finish-back-button').click();
    await expect(page).toHaveURL(/\/mazo\/mazo-1$/);
    await expect(page.getByTestId('cards-list')).toBeVisible();

    // 10. Volver a Mis mazos, con el recuento actualizado.
    await page.getByTestId('back-to-decks').click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByTestId('deck-mazo-1')).toContainText('2 cartas');

    expect(consoleErrors).toEqual([]);

    // La disposición sigue siendo la del dispositivo tras todo el recorrido.
    if (isMobileProject(testInfo.project.name)) {
      await expect(page.getByTestId('app-tabbar')).toBeVisible();
      await expect(page.getByTestId('app-sidebar')).toHaveCount(0);
    } else {
      await expect(page.getByTestId('app-sidebar')).toBeVisible();
      await expect(page.getByTestId('app-tabbar')).toHaveCount(0);
    }
  });

  test('la validación impide crear un mazo sin nombre y lo explica', async ({ page }) => {
    await page.goto('/');

    await page.getByTestId('create-deck-button').click();

    await expect(page.getByRole('alert')).toContainText('Escribe un nombre para el mazo.');
    await expect(page.getByTestId('decks-empty')).toBeVisible();
  });

  test('la validación impide crear una carta incompleta y lo explica', async ({ page }) => {
    await page.goto('/');
    await crearMazo(page, 'Inglés');
    await page.getByTestId('deck-mazo-1').click();
    await expect(page.getByTestId('add-card-button')).toBeVisible();

    await page.getByTestId('card-front-input').fill('to overlook');
    await page.getByTestId('add-card-button').click();

    await expect(page.getByRole('alert')).toContainText('Escribe el reverso de la carta.');
    await expect(page.getByTestId('cards-empty')).toBeVisible();
  });

  test('las calificaciones solo aparecen tras revelar la respuesta', async ({ page }) => {
    await page.goto('/');
    await crearMazo(page, 'Inglés');
    await page.getByTestId('deck-mazo-1').click();
    await anadirCarta(page, 'to overlook', 'pasar por alto');
    await page.getByTestId('study-button').click();
    await expect(page.getByTestId('study-card')).toBeVisible();

    // Antes de revelar no hay ninguna de las cuatro.
    for (const etiqueta of ['Otra vez', 'Difícil', 'Bien', 'Fácil']) {
      await expect(page.getByText(etiqueta, { exact: true })).toHaveCount(0);
    }

    await page.getByTestId('reveal-button').click();

    // Después están las cuatro, en español, y cada una con su intervalo real.
    for (const etiqueta of ['Otra vez', 'Difícil', 'Bien', 'Fácil']) {
      await expect(page.getByText(etiqueta, { exact: true })).toBeVisible();
    }
    for (const testId of ['rate-again', 'rate-hard', 'rate-good', 'rate-easy']) {
      await expect(page.getByTestId(testId)).toHaveAttribute('aria-label', /Volverá en /);
    }
  });

  test('los controles del recorrido son alcanzables con el dedo', async ({ page }, testInfo) => {
    test.skip(!isMobileProject(testInfo.project.name), 'Solo aplica a pantallas táctiles.');

    await page.goto('/');
    await crearMazo(page, 'Inglés');
    await page.getByTestId('deck-mazo-1').click();
    await anadirCarta(page, 'to overlook', 'pasar por alto');
    await page.getByTestId('study-button').click();
    await expect(page.getByTestId('study-card')).toBeVisible();
    // Con la respuesta a la vista para que los cuatro botones de calificación entren en la
    // comprobación: son los controles más pequeños de la pantalla.
    await page.getByTestId('reveal-button').click();
    await expect(page.getByTestId('rating-buttons')).toBeVisible();

    const controles = page.locator(
      '#root [role="button"], #root [role="link"], #root input, #root textarea',
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
});
