import { test, expect } from '@playwright/test';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

const TEST_USER = {
  email: `e2e_${Date.now()}@test.local`,
  password: 'TestPass123!',
  fullName: 'E2E Tester',
};

const SEED_ADMIN = {
  email: process.env.SEED_ADMIN_EMAIL || 'admin@taskflow.local',
  password: process.env.SEED_ADMIN_PASSWORD || 'Admin123!',
};

async function loginAs(page, email, password) {
  await page.goto('/login');
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/dashboard/, { timeout: 15000 });
}

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

    await page.waitForURL(/\/dashboard/, { timeout: 15000 });
    await expect(page.locator('h1')).toContainText('Welcome to TaskFlow Pro');
    await expect(page.getByText(TEST_USER.email)).toBeVisible();
  });

  test('login with registered user', async ({ page }) => {
    await page.goto('/login');

    await page.fill('#email', TEST_USER.email);
    await page.fill('#password', TEST_USER.password);
    await page.click('button[type="submit"]');

    await page.waitForURL(/\/dashboard/, { timeout: 15000 });
    await expect(page.locator('h1')).toContainText('Welcome to TaskFlow Pro');
  });

  test('login with wrong password shows error', async ({ page }) => {
    await page.goto('/login');

    await page.fill('#email', TEST_USER.email);
    await page.fill('#password', 'wrong_password');
    await page.click('button[type="submit"]');

    await expect(page.getByText('Invalid credentials')).toBeVisible({ timeout: 5000 });
  });

  test('register with duplicate email shows error', async ({ page }) => {
    await page.goto('/register');

    await page.fill('#fullName', 'Duplicate User');
    await page.fill('#email', TEST_USER.email);
    await page.fill('#password', 'AnotherPass123!');
    await page.click('button[type="submit"]');

    await expect(page.getByText('Email already in use')).toBeVisible({ timeout: 5000 });
  });

  test('login as seeded admin user', async ({ page }) => {
    await page.goto('/login');

    await page.fill('#email', SEED_ADMIN.email);
    await page.fill('#password', SEED_ADMIN.password);
    await page.click('button[type="submit"]');

    await page.waitForURL(/\/dashboard/, { timeout: 15000 });
    await expect(page.locator('h1')).toContainText('Welcome to TaskFlow Pro');
    await expect(page.getByText(SEED_ADMIN.email)).toBeVisible();
  });
});

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, TEST_USER.email, TEST_USER.password);
  });

  test('shows welcome message and project link', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Welcome to TaskFlow Pro');
    await expect(page.getByText('Go to Projects →')).toBeVisible();
  });

  test('shows user email and role', async ({ page }) => {
    await expect(page.getByText(TEST_USER.email)).toBeVisible();
    await expect(page.getByText('Role: Member')).toBeVisible();
  });

  test('navigates to projects page', async ({ page }) => {
    await page.click('text=Go to Projects →');
    await page.waitForURL(/\/projects/, { timeout: 10000 });
    await expect(page.locator('h1')).toContainText('Projects');
  });

  test('no admin section for Member role', async ({ page }) => {
    await expect(page.getByText('Manage Users →')).not.toBeVisible();
  });
});

test.describe('Dashboard — Admin', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, SEED_ADMIN.email, SEED_ADMIN.password);
  });

  test('shows admin section for Admin role', async ({ page }) => {
    await expect(page.getByText('Manage Users →')).toBeVisible();
  });

  test('navigates to admin users page', async ({ page }) => {
    await page.click('text=Manage Users →');
    await page.waitForURL(/\/admin\/users/, { timeout: 10000 });
  });
});

test.describe('Projects', () => {
  let projectId = '';

  test.beforeEach(async ({ page }) => {
    await loginAs(page, TEST_USER.email, TEST_USER.password);
    await page.goto('/projects');
    await page.waitForSelector('h1');
  });

  test('projects page loads', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Projects');
  });

  test('create a new project', async ({ page }) => {
    await page.click('text=+ New Project');

    const projectName = `E2E Project ${Date.now()}`;
    await page.fill('input[type="text"]', projectName);
    await page.fill('textarea', 'Created by Playwright E2E test');
    await page.click('button[type="submit"]:has-text("Create")');

    await page.waitForURL(/\/projects\//, { timeout: 10000 });
    await expect(page.locator('h1')).toContainText(projectName);

    // Extract project id from URL for subsequent tests
    const url = page.url();
    projectId = url.split('/projects/')[1];
  });

  test('newly created project appears in project list', async ({ page }) => {
    const projectName = `E2E Project ${Date.now()}`;
    await page.click('text=+ New Project');
    await page.fill('input[type="text"]', projectName);
    await page.click('button[type="submit"]:has-text("Create")');
    await page.waitForURL(/\/projects\//, { timeout: 10000 });

    await page.goto('/projects');
    await expect(page.getByText(projectName)).toBeVisible();
  });
});

test.describe('Project Detail', () => {
  let createdProjectId = '';

  test.beforeEach(async ({ page }) => {
    await loginAs(page, TEST_USER.email, TEST_USER.password);

    // Create a project to work with
    await page.goto('/projects');
    const projectName = `Detail Test ${Date.now()}`;
    await page.click('text=+ New Project');
    await page.fill('input[type="text"]', projectName);
    await page.click('button[type="submit"]:has-text("Create")');
    await page.waitForURL(/\/projects\//, { timeout: 10000 });

    const url = page.url();
    createdProjectId = url.split('/projects/')[1];
  });

  test('shows project name, status, and owner', async ({ page }) => {
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.getByText('Planning')).toBeVisible();
    await expect(page.getByText('E2E Tester')).toBeVisible();
  });

  test('shows progress bar and member count', async ({ page }) => {
    await expect(page.getByText('Progress')).toBeVisible();
    await expect(page.getByText('Members (1)')).toBeVisible();
  });

  test('project creator is added as member automatically', async ({ page }) => {
    await expect(page.getByText('Members (1)')).toBeVisible();
    await expect(page.getByText('E2E Tester')).toBeVisible();
  });
});

test.describe('Admin — Seeded Admin', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, SEED_ADMIN.email, SEED_ADMIN.password);
  });

  test('admin can list users', async ({ page }) => {
    await page.goto('/admin/users');
    await page.waitForSelector('h1');
    // Admin sees the users list
    await expect(page.getByText(SEED_ADMIN.email)).toBeVisible();
  });

  test('admin users page shows Admin badge', async ({ page }) => {
    await page.goto('/admin/users');
    await page.waitForSelector('h1');
    await expect(page.getByText('Admin', { exact: true }).first()).toBeVisible();
  });
});

test.describe('Navigation & UI', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, TEST_USER.email, TEST_USER.password);
  });

  test('AppHeader shows user name', async ({ page }) => {
    await expect(page.getByText(TEST_USER.fullName)).toBeVisible();
  });

  test('navigates to profile page from header', async ({ page }) => {
    // Avatar button is the first button in the header
    await page.locator('header button[aria-haspopup="menu"]').click();
    await page.click('a[href="/profile"]');
    await page.waitForURL(/\/profile/, { timeout: 10000 });
    await expect(page.locator('h1')).toContainText('My Profile');
  });

  test('dashboard back button navigates correctly', async ({ page }) => {
    await page.goto('/projects');
    await page.click('text=← Dashboard');
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });
  });
});

test.describe('Tasks — Create, Edit, Status Change', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, TEST_USER.email, TEST_USER.password);
  });

  test('create a task in a project', async ({ page }) => {
    // Create a project first
    await page.goto('/projects');
    const projectName = `Task Test ${Date.now()}`;
    await page.click('text=+ New Project');
    await page.fill('input[type="text"]', projectName);
    await page.click('button[type="submit"]:has-text("Create")');
    await page.waitForURL(/\/projects\//, { timeout: 10000 });

    // Create a task
    await page.click('text=+ New Task');
    await page.fill('input[placeholder="Task title"]', 'E2E Test Task');
    await page.click('button[type="submit"]:has-text("Create")');

    // Verify task appears in list
    await expect(page.getByText('E2E Test Task')).toBeVisible();
  });

  test('view task detail page', async ({ page }) => {
    // Create a project + task
    await page.goto('/projects');
    const projectName = `Detail Task ${Date.now()}`;
    await page.click('text=+ New Project');
    await page.fill('input[type="text"]', projectName);
    await page.click('button[type="submit"]:has-text("Create")');
    await page.waitForURL(/\/projects\//, { timeout: 10000 });

    await page.click('text=+ New Task');
    await page.fill('input[placeholder="Task title"]', 'Detail View Task');
    await page.click('button[type="submit"]:has-text("Create")');

    // Click View on the task
    await page.click('text=View');
    await page.waitForURL(/\/tasks\//, { timeout: 10000 });

    // Verify task detail page loads
    await expect(page.locator('h1')).not.toBeVisible();
    await expect(page.getByText('Detail View Task')).toBeVisible();
    await expect(page.getByText('Activity')).toBeVisible();
  });

  test('change task status from detail page', async ({ page }) => {
    // Create a project + task
    await page.goto('/projects');
    const projectName = `Status Task ${Date.now()}`;
    await page.click('text=+ New Project');
    await page.fill('input[type="text"]', projectName);
    await page.click('button[type="submit"]:has-text("Create")');
    await page.waitForURL(/\/projects\//, { timeout: 10000 });

    await page.click('text=+ New Task');
    await page.fill('input[placeholder="Task title"]', 'Status Change Task');
    await page.click('button[type="submit"]:has-text("Create")');

    // Navigate to task detail
    await page.click('text=View');
    await page.waitForURL(/\/tasks\//, { timeout: 10000 });

    // Change status to InProgress
    await page.selectOption('select', 'InProgress');
    await page.click('button[type="submit"]:has-text("Save")');

    // Verify status badge shows In Progress
    await expect(page.getByText('In Progress')).toBeVisible();
  });

  test('task status badge appears in project list', async ({ page }) => {
    await page.goto('/projects');
    const projectName = `Badge Task ${Date.now()}`;
    await page.click('text=+ New Project');
    await page.fill('input[type="text"]', projectName);
    await page.click('button[type="submit"]:has-text("Create")');
    await page.waitForURL(/\/projects\//, { timeout: 10000 });

    await page.click('text=+ New Task');
    await page.fill('input[placeholder="Task title"]', 'Badge Test Task');
    await page.click('button[type="submit"]:has-text("Create")');

    // Verify To Do badge appears on the task
    await expect(page.getByText('To Do')).toBeVisible();
  });
});

test.describe('API Health', () => {
  test('health endpoint returns ok', async ({ request }) => {
    const res = await request.get(`${API_BASE}/health`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.timestamp).toBeTruthy();
  });
});