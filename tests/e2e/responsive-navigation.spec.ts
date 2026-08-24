import { expect, test, type Page } from '@playwright/test';

/** Mínimo táctil declarado en src/theme/tokens.ts (sizes.touchTarget). */
const TOUCH_TARGET = 44;

const ROUTES = ['/', '/estadisticas', '/componentes'] as const;

function isMobileProject(projectName: string): boolean {
  return projectName.startsWith('mobile-');
}

async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => {
    const doc = document.documentElement;
    return doc.scrollWidth - doc.clientWidth;
  });
}

test.describe('Navegación base', () => {
  test('navega entre las rutas base sin errores de consola', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') {
        consoleErrors.push(message.text());
      }
    });

    await page.goto('/');
    await expect(page.getByTestId('create-deck-button')).toBeVisible();

    await page.getByTestId('nav-componentes').click();
    await expect(page.getByRole('heading', { name: 'Componentes' })).toBeVisible();
    await expect(page).toHaveURL(/\/componentes$/);
    await expect(page.getByTestId('catalogo-button-primary')).toBeVisible();

    await page.getByTestId('nav-mazos').click();
    await expect(page.getByTestId('create-deck-button')).toBeVisible();
    await expect(page).toHaveURL(/\/$/);

    expect(consoleErrors).toEqual([]);
  });
});

test.describe('Disposición responsive', () => {
  test('muestra la navegación propia del tamaño de pantalla', async ({ page }, testInfo) => {
    await page.goto('/');

    if (isMobileProject(testInfo.project.name)) {
      await expect(page.getByTestId('app-tabbar')).toBeVisible();
      await expect(page.getByTestId('app-header')).toBeVisible();
      await expect(page.getByTestId('app-sidebar')).toHaveCount(0);
    } else {
      await expect(page.getByTestId('app-sidebar')).toBeVisible();
      await expect(page.getByTestId('app-tabbar')).toHaveCount(0);
    }
  });

  for (const route of ROUTES) {
    test(`no produce overflow horizontal en ${route}`, async ({ page }) => {
      await page.goto(route);
      await expect(page.getByTestId('app-scroll')).toBeVisible();

      expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    });
  }
});

test.describe('Accesibilidad táctil', () => {
  for (const route of ROUTES) {
    test(`los controles interactivos son alcanzables con el dedo en ${route}`, async ({
      page,
    }, testInfo) => {
      test.skip(!isMobileProject(testInfo.project.name), 'Solo aplica a pantallas táctiles.');

      await page.goto(route);
      await expect(page.getByTestId('app-tabbar')).toBeVisible();

      const controles = page.locator(
        '#root [role="button"], #root [role="link"], #root input, #root textarea',
      );
      const total = await controles.count();
      expect(total).toBeGreaterThan(0);

      const demasiadoPequenos: string[] = [];
      for (let i = 0; i < total; i += 1) {
        const control = controles.nth(i);
        if (!(await control.isVisible())) {
          continue;
        }
        const caja = await control.boundingBox();
        if (!caja) {
          continue;
        }
        if (caja.height < TOUCH_TARGET || caja.width < TOUCH_TARGET) {
          const texto = (await control.textContent())?.trim() ?? '(sin texto)';
          demasiadoPequenos.push(`${texto}: ${Math.round(caja.width)}x${Math.round(caja.height)}`);
        }
      }

      expect(demasiadoPequenos).toEqual([]);
    });
  }
});
