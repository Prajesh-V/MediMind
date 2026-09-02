import { test, expect } from '@playwright/test';

test('Smoke test: patient login and navigate to protected page', async ({ page }) => {
  // 1. Open application
  await page.goto('/');
  await expect(page).toHaveTitle(/MediMind/i);

  // 2. Patient Login
  // Our seed script created patient_a@test.local with password Password123!
  await page.fill('input[placeholder="Enter email or mobile"]', 'patient_a@test.local');
  await page.fill('input[placeholder="Enter password"]', 'Password123!');
  await page.click('button:has-text("Continue to MediMind")');

  // 3. Navigate to one protected patient page
  // The app should redirect to /patient or we can click a nav link
  await page.waitForURL('**/patient**');
  
  // Let's verify authenticated content loads (e.g. greeting or dashboard elements)
  const dashboardHeader = page.locator('h1, h2, h3').filter({ hasText: /Welcome|Dashboard|Patient/i });
  await expect(dashboardHeader.first()).toBeVisible({ timeout: 10000 });
  
  // Check that we can navigate to medications page
  await page.goto('/patient/medications');
  await expect(page.locator('text=Medication Management').first()).toBeVisible({ timeout: 10000 });
});
