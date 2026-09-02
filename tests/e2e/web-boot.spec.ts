import { expect, test } from '@playwright/test';
import { conSesion } from './support/auth';

// Estas pruebas no van de acceso, pero desde TASK-008 la aplicación lo exige: se parte
// de una sesión ya iniciada. El acceso tiene sus propias suites.
test.beforeEach(async ({ page }) => {
  await conSesion(page);
});

test('la app arranca en web y renderiza la pantalla raíz', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });

  const response = await page.goto('/');

  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { name: 'Mis mazos' })).toBeVisible();
  await expect(page.getByTestId('create-deck-button')).toBeVisible();
  await expect(page.getByTestId('decks-empty')).toBeVisible();
  expect(consoleErrors).toEqual([]);
});
