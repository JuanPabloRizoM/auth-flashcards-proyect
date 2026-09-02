import { expect, test } from '@playwright/test';

import { iniciarSesion, sinSesion, USUARIO_A, USUARIO_B } from './support/auth';

/**
 * Dos cuentas en el mismo dispositivo.
 *
 * El ciclo obligatorio: A crea, A se va, B entra y no ve nada de A, B crea lo suyo, A vuelve
 * y encuentra lo suyo y solo lo suyo. Los datos siguen siendo locales: esto no es
 * sincronización, y en otro dispositivo A no vería nada de esto.
 */

test.beforeEach(async ({ page }) => {
  await sinSesion(page);
});

async function crearMazo(page: import('@playwright/test').Page, nombre: string) {
  await page.getByTestId('deck-name-input').fill(nombre);
  await page.getByTestId('create-deck-button').click();
  await expect(page.getByText(nombre)).toBeVisible();
}

async function cerrarSesion(page: import('@playwright/test').Page) {
  await page.getByTestId('cerrar-sesion').click();
  await expect(page).toHaveURL(/\/login$/);
}

test('los datos locales de una cuenta no son visibles para la otra', async ({ page }) => {
  await page.goto('/login');

  // ── A ────────────────────────────────────────────────────────────────────────
  await iniciarSesion(page, USUARIO_A);
  await expect(page.getByRole('heading', { name: 'Mis mazos' })).toBeVisible();
  await crearMazo(page, 'Privado A');
  await cerrarSesion(page);

  // ── B ────────────────────────────────────────────────────────────────────────
  await iniciarSesion(page, USUARIO_B);
  await expect(page.getByRole('heading', { name: 'Mis mazos' })).toBeVisible();
  await expect(page.getByText('Privado A')).toHaveCount(0);
  await expect(page.getByTestId('decks-empty')).toBeVisible();

  await crearMazo(page, 'Privado B');
  await expect(page.getByText('Privado A')).toHaveCount(0);
  await cerrarSesion(page);

  // ── A otra vez ───────────────────────────────────────────────────────────────
  await iniciarSesion(page, USUARIO_A);
  await expect(page.getByText('Privado A')).toBeVisible();
  await expect(page.getByText('Privado B')).toHaveCount(0);
});

test('las claves del almacenamiento del navegador llevan el identificador de cada cuenta', async ({
  page,
}) => {
  await page.goto('/login');
  await iniciarSesion(page, USUARIO_A);
  await crearMazo(page, 'Privado A');
  await cerrarSesion(page);
  await iniciarSesion(page, USUARIO_B);
  await crearMazo(page, 'Privado B');

  const claves = await page.evaluate(() => Object.keys(window.localStorage).sort());
  const deDatos = claves.filter((clave) => clave.includes(':library:') || clave.includes(':history:'));

  expect(deDatos.length).toBeGreaterThan(0);
  for (const clave of deDatos) {
    expect(clave.startsWith('flashcards:user:')).toBe(true);
  }
  expect(claves).toContain(`flashcards:user:${USUARIO_A.id}:library:v1`);
  expect(claves).toContain(`flashcards:user:${USUARIO_B.id}:library:v1`);

  // Y el contenido de cada documento es solo el de su dueño.
  const documentoDeA = await page.evaluate(
    (clave) => window.localStorage.getItem(clave),
    `flashcards:user:${USUARIO_A.id}:library:v1`,
  );
  expect(documentoDeA).toContain('Privado A');
  expect(documentoDeA).not.toContain('Privado B');
});

test('las cartas y el estudio de una cuenta tampoco se cruzan', async ({ page }) => {
  await page.goto('/login');
  await iniciarSesion(page, USUARIO_A);
  await crearMazo(page, 'Privado A');
  await page.getByTestId('deck-mazo-1').click();
  await page.getByTestId('card-front-input').fill('secreto de A');
  await page.getByTestId('card-back-input').fill('reverso de A');
  await page.getByTestId('add-card-button').click();
  await expect(page.getByText('secreto de A')).toBeVisible();
  await page.getByTestId('nav-mazos').click();
  await cerrarSesion(page);

  await iniciarSesion(page, USUARIO_B);
  await expect(page.getByText('secreto de A')).toHaveCount(0);
  await page.goto('/mazo/mazo-1');

  // El mazo de A no existe en el espacio de B, ni siquiera abriendo su URL.
  await expect(page.getByText('Ese mazo ya no existe')).toBeVisible();
});
