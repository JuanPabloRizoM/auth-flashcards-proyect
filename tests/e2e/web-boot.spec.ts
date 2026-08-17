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
  await expect(page.getByRole('heading', { name: 'Flashcards' })).toBeVisible();
  await expect(page.getByTestId('demo-card')).toBeVisible();
  expect(consoleErrors).toEqual([]);
});
