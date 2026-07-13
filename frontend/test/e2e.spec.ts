import { test, expect } from '@playwright/test';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

const TEST_USER = {
  email: `e2e_${Date.now()}@test.local`,
  password: 'TestPass123!',
  fullName: 'E2E Tester',
};

test.describe('Landing Page', () => {
  test('loads with TaskFlow Pro heading and auth links', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('TaskFlow Pro');
    await expect(page.locator('a[href="/login"]')).toBeVisible();
    await expect(page.locator('a[href="/register"]')).toBeVisible();
  });
});

test.describe('Registration & Authentication', () => {
  test('register a new user and redirects to dashboard', async ({ page }) => {
    await page.goto('/register');

    await page.fill('#fullName', TEST_USER.fullName);
    await page.fill('#email', TEST_USER.email);
    await page.fill('#password', TEST_USER.password);
    await page.click('button[type="submit"]');

    await page.waitForURL(/\/dashboard/, { timeout: 10000 });
    await expect(page.locator('h1')).toContainText('Welcome to TaskFlow Pro');
    await expect(page.getByText(TEST_USER.email)).toBeVisible();
  });

  test('login with registered user', async ({ page }) => {
    await page.goto('/login');

    await page.fill('#email', TEST_USER.email);
    await page.fill('#password', TEST_USER.password);
    await page.click('button[type="submit"]');

    await page.waitForURL(/\/dashboard/, { timeout: 10000 });
    await expect(page.locator('h1')).toContainText('Welcome to TaskFlow Pro');
  });

  test('login with wrong password shows error', async ({ page }) => {
    await page.goto('/login');

    await page.fill('#email', TEST_USER.email);
    await page.fill('#password', 'wrong_password');
    await page.click('button[type="submit"]');

    await expect(page.getByText('Invalid credentials')).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', TEST_USER.email);
    await page.fill('#password', TEST_USER.password);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });
  });

  test('shows welcome message and project link', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Welcome to TaskFlow Pro');
    await expect(page.getByText('Go to Projects →')).toBeVisible();
  });

  test('navigates to projects page', async ({ page }) => {
    await page.click('text=Go to Projects →');
    await page.waitForURL(/\/projects/, { timeout: 10000 });
    await expect(page.locator('h1')).toContainText('Projects');
  });
});

test.describe('Projects', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', TEST_USER.email);
    await page.fill('#password', TEST_USER.password);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });
    await page.goto('/projects');
    await page.waitForSelector('h1');
  });

  test('projects page loads', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Projects');
  });

  test('create a new project', async ({ page }) => {
    await page.click('text=+ New Project');
    await page.fill('input[type="text"]', 'E2E Test Project');
    await page.click('button[type="submit"]:has-text("Create")');

    await page.waitForURL(/\/projects\//, { timeout: 10000 });
  });
});

test.describe('API Health', () => {
  test('health endpoint returns ok', async ({ request }) => {
    const res = await request.get(`${API_BASE}/health`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.status).toBe('ok');
  });
});