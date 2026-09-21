// @ts-check
const { defineConfig, devices } = require('@playwright/test');
const path = require('path');
const selectedProjects = process.env.PLAYWRIGHT_PROJECTS?.split(',').map(item => item.trim()).filter(Boolean);
const repositoryRoot = path.resolve(__dirname, '..', '..', '..');
const artifactRoot = process.env.YASDB_TEST_ARTIFACT_DIR
  ? path.resolve(process.env.YASDB_TEST_ARTIFACT_DIR)
  : path.join(repositoryRoot, 'runtime', 'test-results', 'playwright', new Date().toISOString().replace(/[:.]/g, '-'));

module.exports = defineConfig({
  testDir: '../../e2e/agent-runner',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: 1,
  reporter: [['list']],
  globalSetup: path.join(__dirname, '..', '..', 'e2e', 'agent-runner', 'test-environment-guard.cjs'),
  outputDir: path.join(artifactRoot, 'playwright'),
  timeout: 30000,
  expect: { timeout: 10000 },
  use: {
    baseURL: 'http://localhost:3500',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10000,
    navigationTimeout: 15000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
  ].filter(project => !selectedProjects || selectedProjects.includes(project.name)),
  webServer: undefined,
});
