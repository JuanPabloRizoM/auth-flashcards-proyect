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
  await expect(page.getByRole('heading', { name: 'Mis mazos' })).toBeVisible();
  await expect(page.getByTestId('create-deck-button')).toBeVisible();
  await expect(page.getByTestId('decks-empty')).toBeVisible();
  expect(consoleErrors).toEqual([]);
});
