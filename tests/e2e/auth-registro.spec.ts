import { expect, test } from '@playwright/test';

import { sinCuentas, sinSesion } from './support/auth';

/**
 * Crear cuenta en el navegador real.
 *
 * AUTOMATED AUTH CONTRACT: el proveedor es el doble determinista. El alta real contra un
 * proyecto Supabase, con su correo de confirmación, necesita credenciales y se verifica aparte.
 */

test.describe('La pantalla de opciones', () => {
  test.beforeEach(async ({ page }) => {
    await sinCuentas(page);
  });

  test('ofrece primero las dos maneras, sin pedir todavía ningún dato', async ({ page }) => {
    await page.goto('/registro');

    await expect(page.getByRole('heading', { name: 'Crear cuenta' })).toBeVisible();
    await expect(page.getByTestId('registro-con-correo')).toBeVisible();
    await expect(page.getByTestId('registro-google')).toBeVisible();
    await expect(page.getByTestId('registro-email')).toHaveCount(0);
  });

  test('el formulario de correo aparece al pedirlo, con sus tres campos ocultos donde toca', async ({
    page,
  }) => {
    await page.goto('/registro');
    await page.getByTestId('registro-con-correo').click();

    await expect(page.getByLabel('Correo electrónico')).toBeVisible();
    await expect(page.getByTestId('registro-password')).toHaveAttribute('type', 'password');
    await expect(page.getByTestId('registro-password-confirm')).toHaveAttribute('type', 'password');
  });

  test('"Volver" devuelve a las opciones', async ({ page }) => {
    await page.goto('/registro');
    await page.getByTestId('registro-con-correo').click();
    await page.getByTestId('registro-volver').click();

    await expect(page.getByTestId('registro-con-correo')).toBeVisible();
    await expect(page.getByTestId('registro-email')).toHaveCount(0);
  });

  test('el enlace lleva a iniciar sesión', async ({ page }) => {
    await page.goto('/registro');
    await page.getByTestId('registro-ir-a-login').click();

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();
  });
});

test.describe('Alta con correo', () => {
  test.beforeEach(async ({ page }) => {
    await sinCuentas(page);
  });

  test('crea la cuenta y entra a la aplicación', async ({ page }) => {
    await page.goto('/registro');
    await page.getByTestId('registro-con-correo').click();
    await page.getByTestId('registro-email').fill('nueva@example.com');
    await page.getByTestId('registro-password').fill('contrasena-larga');
    await page.getByTestId('registro-password-confirm').fill('contrasena-larga');
    await page.getByTestId('registro-submit').click();

    await expect(page.getByRole('heading', { name: 'Mis mazos' })).toBeVisible();
  });

  test('dos contraseñas distintas se rechazan y no crean nada', async ({ page }) => {
    await page.goto('/registro');
    await page.getByTestId('registro-con-correo').click();
    await page.getByTestId('registro-email').fill('nueva@example.com');
    await page.getByTestId('registro-password').fill('contrasena-larga');
    await page.getByTestId('registro-password-confirm').fill('otra-distinta');
    await page.getByTestId('registro-submit').click();

    await expect(page.getByText('Las dos contraseñas no coinciden.')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Mis mazos' })).toHaveCount(0);
  });

  test('los campos vacíos se piden antes de enviar', async ({ page }) => {
    await page.goto('/registro');
    await page.getByTestId('registro-con-correo').click();
    await page.getByTestId('registro-submit').click();

    await expect(page.getByTestId('registro-email-error')).toBeVisible();
    await expect(page.getByTestId('registro-password-error')).toBeVisible();
    await expect(page.getByTestId('registro-password-confirm-error')).toBeVisible();
  });

  test('la cuenta creada sirve para volver a entrar después', async ({ page }) => {
    await page.goto('/registro');
    await page.getByTestId('registro-con-correo').click();
    await page.getByTestId('registro-email').fill('nueva@example.com');
    await page.getByTestId('registro-password').fill('contrasena-larga');
    await page.getByTestId('registro-password-confirm').fill('contrasena-larga');
    await page.getByTestId('registro-submit').click();
    await expect(page.getByRole('heading', { name: 'Mis mazos' })).toBeVisible();

    await page.getByTestId('cerrar-sesion').click();
    await expect(page).toHaveURL(/\/login$/);

    await page.getByTestId('login-email').fill('nueva@example.com');
    await page.getByTestId('login-password').fill('contrasena-larga');
    await page.getByTestId('login-submit').click();

    await expect(page.getByRole('heading', { name: 'Mis mazos' })).toBeVisible();
  });
});

test.describe('Alta con Google', () => {
  test.beforeEach(async ({ page }) => {
    await sinSesion(page);
  });

  test('el botón de Google del registro entra a la aplicación', async ({ page }) => {
    await page.goto('/registro');
    await page.getByTestId('registro-google').click();

    await expect(page.getByRole('heading', { name: 'Mis mazos' })).toBeVisible();
  });
});
