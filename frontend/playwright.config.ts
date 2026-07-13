const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: './test',
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
  },
});