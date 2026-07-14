const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './test',
  fullyParallel: false,
  retries: 1,
  timeout: 30000,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: process.env.DOCKER_STACK
      ? 'echo "Using docker stack at $PLAYWRIGHT_BASE_URL"'
      : 'npm run dev',
    url: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 120000,
  },
});