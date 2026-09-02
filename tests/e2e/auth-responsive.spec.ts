import { expect, test, type Page } from '@playwright/test';

import { conSesion, sinSesion, USUARIO_A } from './support/auth';

/**
 * Las pantallas de acceso en cada tamaño.
 *
 * Se ejecuta en los tres perfiles del proyecto —escritorio, Pixel 5 e iPhone 13— y además
 * fuerza 320 px, que es el ancho más estrecho que el proyecto se compromete a servir.
 */

async function desbordeHorizontal(page: Page): Promise<number> {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}

async function alturaDe(page: Page, testID: string): Promise<number> {
  const caja = await page.getByTestId(testID).boundingBox();
  return caja?.height ?? 0;
}

test.describe('Sin sesión', () => {
  test.beforeEach(async ({ page }) => {
    await sinSesion(page);
  });

  for (const ruta of ['/login', '/registro']) {
    test(`${ruta} se ve entera y sin desbordamiento en este dispositivo`, async ({ page }) => {
      await page.goto(ruta);
      await expect(page.getByRole('heading', { name: /Iniciar sesión|Crear cuenta/ })).toBeVisible();

      expect(await desbordeHorizontal(page)).toBe(0);
    });
  }

  test('a 320 px sigue sin desbordar y todo sigue alcanzable', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto('/login');

    await expect(page.getByLabel('Correo electrónico')).toBeVisible();
    await expect(page.getByLabel('Contraseña')).toBeVisible();
    await expect(page.getByTestId('login-submit')).toBeVisible();
    await expect(page.getByTestId('login-google')).toBeVisible();
    await expect(page.getByTestId('login-ir-a-registro')).toBeVisible();
    expect(await desbordeHorizontal(page)).toBe(0);

    await page.goto('/registro');
    await expect(page.getByTestId('registro-con-correo')).toBeVisible();
    expect(await desbordeHorizontal(page)).toBe(0);

    await page.getByTestId('registro-con-correo').click();
    await expect(page.getByTestId('registro-password-confirm')).toBeVisible();
    expect(await desbordeHorizontal(page)).toBe(0);
  });

  test('los controles cumplen el mínimo táctil del sistema visual', async ({ page }) => {
    await page.goto('/login');

    for (const testID of ['login-submit', 'login-google', 'login-ir-a-registro']) {
      expect(await alturaDe(page, testID)).toBeGreaterThanOrEqual(44);
    }
  });

  test('cada campo es alcanzable por su etiqueta, y se recorre con el teclado', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel('Correo electrónico').fill(USUARIO_A.email);
    await page.keyboard.press('Tab');
    await page.keyboard.type(USUARIO_A.password);

    await expect(page.getByTestId('login-password')).toHaveValue(USUARIO_A.password);

    await page.getByTestId('login-password').press('Enter');
    await expect(page.getByRole('heading', { name: 'Mis mazos' })).toBeVisible();
  });
});

test.describe('Con sesión', () => {
  test.beforeEach(async ({ page }) => {
    await conSesion(page);
  });

  test('cerrar sesión es alcanzable en este dispositivo', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByTestId('cerrar-sesion')).toBeVisible();
    expect(await alturaDe(page, 'cerrar-sesion')).toBeGreaterThanOrEqual(44);
    expect(await desbordeHorizontal(page)).toBe(0);
  });

  test('a 320 px la aplicación sigue sin desbordar y se puede cerrar sesión', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Mis mazos' })).toBeVisible();

    expect(await desbordeHorizontal(page)).toBe(0);
    await page.getByTestId('cerrar-sesion').click();
    await expect(page).toHaveURL(/\/login$/);
  });
});
