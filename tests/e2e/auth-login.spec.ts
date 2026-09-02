import { expect, test } from '@playwright/test';

import { iniciarSesion, sinSesion, USUARIO_A } from './support/auth';

/**
 * Iniciar sesión en el navegador real.
 *
 * AUTOMATED AUTH CONTRACT: el servicio de autenticación es el doble determinista, así que lo
 * que se demuestra es el comportamiento de la aplicación —campos, envío, error, entrada a la
 * zona privada—. La integración con Supabase y con Google necesita credenciales y se verifica
 * aparte.
 */

test.beforeEach(async ({ page }) => {
  await sinSesion(page);
});

test.describe('La pantalla de acceso', () => {
  test('se muestra sin sesión, con sus dos campos y sus dos caminos', async ({ page }) => {
    await page.goto('/login');

    await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();
    await expect(page.getByLabel('Correo electrónico')).toBeVisible();
    await expect(page.getByLabel('Contraseña')).toBeVisible();
    await expect(page.getByTestId('login-submit')).toBeVisible();
    await expect(page.getByTestId('login-google')).toBeVisible();
    await expect(page.getByTestId('login-ir-a-registro')).toBeVisible();
  });

  test('la contraseña no se ve, y el correo declara su autocompletado', async ({ page }) => {
    await page.goto('/login');

    await expect(page.getByTestId('login-password')).toHaveAttribute('type', 'password');
    await expect(page.getByTestId('login-email')).toHaveAttribute('autocomplete', 'email');
  });

  test('no aparece ningún error de consola', async ({ page }) => {
    const errores: string[] = [];
    page.on('console', (mensaje) => {
      if (mensaje.type() === 'error') errores.push(mensaje.text());
    });

    await page.goto('/login');
    await expect(page.getByTestId('login-submit')).toBeVisible();

    expect(errores).toEqual([]);
  });
});

test.describe('Entrar con correo', () => {
  test('con credenciales válidas se entra a la aplicación', async ({ page }) => {
    await page.goto('/login');
    await iniciarSesion(page, USUARIO_A);

    await expect(page.getByRole('heading', { name: 'Mis mazos' })).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
  });

  test('con credenciales inválidas se queda fuera, con un mensaje genérico', async ({ page }) => {
    await page.goto('/login');
    await iniciarSesion(page, { email: USUARIO_A.email, password: 'no-es-esta' });

    await expect(page.getByTestId('login-error')).toBeVisible();
    await expect(page.getByText('No pudimos iniciar sesión con esos datos.')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Mis mazos' })).toHaveCount(0);
  });

  test('una dirección que no existe da exactamente el mismo mensaje', async ({ page }) => {
    await page.goto('/login');
    await iniciarSesion(page, { email: 'nadie@example.com', password: 'lo-que-sea' });

    await expect(page.getByText('No pudimos iniciar sesión con esos datos.')).toBeVisible();
    await expect(page.getByText(/no existe|no encontrad|no registrad/i)).toHaveCount(0);
  });

  test('los campos obligatorios se piden antes de enviar', async ({ page }) => {
    await page.goto('/login');
    await page.getByTestId('login-submit').click();

    await expect(page.getByTestId('login-email-error')).toBeVisible();
    await expect(page.getByTestId('login-password-error')).toBeVisible();
  });

  test('se puede enviar desde el campo de contraseña, con el teclado', async ({ page }) => {
    await page.goto('/login');
    await page.getByTestId('login-email').fill(USUARIO_A.email);
    await page.getByTestId('login-password').fill(USUARIO_A.password);
    await page.getByTestId('login-password').press('Enter');

    await expect(page.getByRole('heading', { name: 'Mis mazos' })).toBeVisible();
  });
});

test.describe('Entrar con Google', () => {
  test('el botón abre el flujo y acaba en la aplicación', async ({ page }) => {
    await page.goto('/login');
    await page.getByTestId('login-google').click();

    await expect(page.getByRole('heading', { name: 'Mis mazos' })).toBeVisible();
  });

  test('la sesión creada con Google sobrevive a recargar', async ({ page }) => {
    await page.goto('/login');
    await page.getByTestId('login-google').click();
    await expect(page.getByRole('heading', { name: 'Mis mazos' })).toBeVisible();

    await page.reload();

    await expect(page.getByRole('heading', { name: 'Mis mazos' })).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
  });

  test('después de entrar no quedan datos de autenticación en la URL', async ({ page }) => {
    await page.goto('/login');
    await page.getByTestId('login-google').click();
    await expect(page.getByRole('heading', { name: 'Mis mazos' })).toBeVisible();

    const url = page.url();
    for (const rastro of ['access_token', 'refresh_token', 'code=', 'token_type']) {
      expect(url).not.toContain(rastro);
    }
  });
});

test.describe('Ir al registro', () => {
  test('el enlace lleva a crear cuenta', async ({ page }) => {
    await page.goto('/login');
    await page.getByTestId('login-ir-a-registro').click();

    await expect(page).toHaveURL(/\/registro$/);
    await expect(page.getByRole('heading', { name: 'Crear cuenta' })).toBeVisible();
  });
});
