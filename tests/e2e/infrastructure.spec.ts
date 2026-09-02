import { test, expect } from '@playwright/test';

test('infrastructure: MediMind front page is accessible', async ({ page }) => {
  // Wait for the dev server to be fully reachable
  await page.goto('/');
  // Basic assertion to ensure Next.js has loaded something
  await expect(page.locator('body')).toBeVisible();
});
