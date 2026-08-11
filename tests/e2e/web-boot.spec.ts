import { expect, test } from '@playwright/test';

test('la app arranca en web y renderiza la pantalla raíz', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });

  const response = await page.goto('/');

  expect(response?.status()).toBe(200);
  await expect(page.getByText('Flashcards')).toBeVisible();
  await expect(page.getByText('Entorno base preparado.')).toBeVisible();
  expect(consoleErrors).toEqual([]);
});
