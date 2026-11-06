const { defineConfig, devices } = require('@playwright/test');
const path = require('node:path');

module.exports = defineConfig({
  testDir: '../../e2e/agent-runner',
  testMatch: 'knowledge-center-review-workbench.spec.js',
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  timeout: 60000,
  expect: { timeout: 15000 },
  outputDir: path.resolve(__dirname, '../../../runtime/coverage-goal/review-playwright'),
  use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
