import { test, expect } from '@playwright/test';

test('has title', async ({ page }) => {
  await page.goto('/');
  // Assume que a aplicação redireciona para /login ou mostra "Realize" no título
  await expect(page).toHaveTitle(/Realize/);
});
