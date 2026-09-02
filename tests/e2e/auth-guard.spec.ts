import { expect, test, type Page } from '@playwright/test';

import { conSesion, sinSesion } from './support/auth';

/**
 * Protección de rutas, comprobada abriendo cada URL directamente.
 *
 * No basta con que la navegación interna no lleve a una pantalla privada: hay que teclear la
 * dirección y comprobar que no se llega.
 */

const RUTAS_PRIVADAS = [
  '/',
  '/estadisticas',
  '/componentes',
  '/mazo/mazo-1',
  '/mazo/mazo-1/estudiar',
  '/mazo/mazo-1/importar',
];

/**
 * Cuántos marcos de la aplicación privada hay montados.
 *
 * `app-scroll` es el contenedor de `AppShell`, y `AppShell` solo existe dentro del grupo
 * privado. Sirve para las dos disposiciones: en escritorio el marco lleva sidebar y en móvil
 * barra inferior, pero el contenedor es el mismo.
 */
async function marcoPrivadoMontado(page: Page): Promise<number> {
  return page.getByTestId('app-scroll').count();
}

test.describe('Sin sesión', () => {
  test.beforeEach(async ({ page }) => {
    await sinSesion(page);
  });

  for (const ruta of RUTAS_PRIVADAS) {
    test(`abrir ${ruta} directamente acaba en el acceso`, async ({ page }) => {
      await page.goto(ruta);

      await expect(page).toHaveURL(/\/login$/);
      await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();
      expect(await marcoPrivadoMontado(page)).toBe(0);
    });
  }

  test('/login es pública y no redirige', async ({ page }) => {
    await page.goto('/login');

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByTestId('login-submit')).toBeVisible();
  });

  test('/registro es pública y no redirige', async ({ page }) => {
    await page.goto('/registro');

    await expect(page).toHaveURL(/\/registro$/);
    await expect(page.getByTestId('registro-con-correo')).toBeVisible();
  });

  test('la redirección se estabiliza: no hay bucle', async ({ page }) => {
    const visitadas: string[] = [];
    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame()) visitadas.push(frame.url());
    });

    await page.goto('/estadisticas');
    await expect(page.getByTestId('login-submit')).toBeVisible();
    await page.waitForTimeout(500);

    await expect(page).toHaveURL(/\/login$/);
    // Una redirección, no una cadena de ellas.
    expect(visitadas.length).toBeLessThanOrEqual(3);
  });
});

test.describe('Con sesión', () => {
  test.beforeEach(async ({ page }) => {
    await conSesion(page);
  });

  for (const ruta of RUTAS_PRIVADAS) {
    test(`abrir ${ruta} directamente funciona`, async ({ page }) => {
      await page.goto(ruta);

      await expect(page.getByTestId('app-scroll')).toBeVisible();
      await expect(page).not.toHaveURL(/\/login$/);
    });
  }

  test('quedarse en /login no tiene sentido: se entra a la aplicación', async ({ page }) => {
    await page.goto('/login');

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { name: 'Mis mazos' })).toBeVisible();
  });

  test('/registro hace lo mismo', async ({ page }) => {
    await page.goto('/registro');

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { name: 'Mis mazos' })).toBeVisible();
  });
});
