import { defineConfig, devices } from '@playwright/test'

const BASE_URL = process.env.E2E_BASE_URL || 'http://127.0.0.1:43130'

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  outputDir: '../docs/test-report/raw/playwright-artifacts',
  reporter: [
    ['list'],
    ['html', { outputFolder: '../docs/test-report/playwright-html', open: 'never' }],
    ['json', { outputFile: '../docs/test-report/raw/playwright.json' }],
  ],
  use: {
    baseURL: BASE_URL,
    locale: 'fr-FR',
    viewport: { width: 1280, height: 800 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } }],
})
