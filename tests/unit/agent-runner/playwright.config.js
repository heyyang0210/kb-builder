// @ts-check
const { defineConfig, devices } = require('@playwright/test');
const selectedProjects = process.env.PLAYWRIGHT_PROJECTS?.split(',').map(item => item.trim()).filter(Boolean);

module.exports = defineConfig({
  testDir: '../../e2e/agent-runner',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: 1,
  reporter: [
    ['html', { open: 'never', outputFolder: '../../e2e/agent-runner/reports' }],
    ['list']
  ],
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
