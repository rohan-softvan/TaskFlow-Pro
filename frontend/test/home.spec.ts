import { test, expect } from '@playwright/test';

test('landing page loads with TaskFlow Pro heading', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toContainText('TaskFlow Pro');
  await expect(page.locator('a[href="/login"]')).toBeVisible();
  await expect(page.locator('a[href="/register"]')).toBeVisible();
});
