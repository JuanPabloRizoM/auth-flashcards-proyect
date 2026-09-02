import { expect, test } from '@playwright/test';

import { conSesion, iniciarSesion, sinSesion, USUARIO_A } from './support/auth';

/**
 * Persistencia de la sesión en web, y su cierre.
 *
 * Lo que se prueba aquí es el comportamiento del navegador alrededor de la sesión: recarga,
 * navegación directa, botón atrás y cierre.
 */

test.describe('La sesión sobrevive', () => {
  test.beforeEach(async ({ page }) => {
    await conSesion(page);
  });

  test('a recargar la página', async ({ page }) => {
    await page.goto('/estadisticas');
    await expect(page.getByRole('heading', { name: 'Estadísticas' })).toBeVisible();

    await page.reload();

    await expect(page.getByRole('heading', { name: 'Estadísticas' })).toBeVisible();
    await expect(page).toHaveURL(/\/estadisticas$/);
  });

  test('a abrir una URL privada directamente', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Mis mazos' })).toBeVisible();

    await page.goto('/componentes');

    await expect(page).toHaveURL(/\/componentes$/);
    await expect(page.getByTestId('app-scroll')).toBeVisible();
  });

  test('y no se pierde al navegar entre secciones', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('nav-estadisticas').click();
    await expect(page.getByRole('heading', { name: 'Estadísticas' })).toBeVisible();
    await page.getByTestId('nav-mazos').click();

    await expect(page.getByRole('heading', { name: 'Mis mazos' })).toBeVisible();
  });
});

test.describe('Cerrar sesión', () => {
  test.beforeEach(async ({ page }) => {
    await conSesion(page);
  });

  test('la acción está a mano y devuelve al acceso', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('cuenta-email')).toContainText(USUARIO_A.email);

    await page.getByTestId('cerrar-sesion').click();

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();
    await expect(page.getByTestId('app-scroll')).toHaveCount(0);
  });

  test('después de cerrar, el botón atrás no devuelve el contenido privado', async ({ page }) => {
    // Dos entradas reales de historial antes de cerrar sesión, para que "atrás" tenga a
    // dónde volver.
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Mis mazos' })).toBeVisible();
    await page.goto('/estadisticas');
    await expect(page.getByRole('heading', { name: 'Estadísticas' })).toBeVisible();

    await page.getByTestId('cerrar-sesion').click();
    await expect(page).toHaveURL(/\/login$/);

    await page.goBack();

    // La entrada anterior era una ruta privada: el guard la vuelve a mandar al acceso.
    await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();
    await expect(page.getByTestId('app-scroll')).toHaveCount(0);
    await expect(page).toHaveURL(/\/login$/);
  });

  test('después de cerrar, recargar sigue sin sesión', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('cerrar-sesion').click();
    await expect(page).toHaveURL(/\/login$/);

    await page.reload();

    await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();
  });

  test('cerrar sesión no borra los datos: al volver siguen ahí', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('deck-name-input').fill('Mazo que se queda');
    await page.getByTestId('create-deck-button').click();
    await expect(page.getByText('Mazo que se queda')).toBeVisible();

    await page.getByTestId('cerrar-sesion').click();
    await expect(page).toHaveURL(/\/login$/);
    await iniciarSesion(page, USUARIO_A);

    await expect(page.getByText('Mazo que se queda')).toBeVisible();
  });
});

test.describe('Sin sesión previa', () => {
  test('entrar y recargar mantiene la sesión recién creada', async ({ page }) => {
    await sinSesion(page);
    await page.goto('/login');
    await iniciarSesion(page, USUARIO_A);
    await expect(page.getByRole('heading', { name: 'Mis mazos' })).toBeVisible();

    await page.reload();

    await expect(page.getByRole('heading', { name: 'Mis mazos' })).toBeVisible();
  });
});
