import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  reporter: [['list']],
  use: {
    locale: 'en-US',
    viewport: { width: 1280, height: 900 },
    trace: 'retain-on-failure',
    navigationTimeout: 15_000,
    actionTimeout: 10_000,
  },
  projects: [
    {
      // Captured pages served at their real URLs: fast and deterministic.
      name: 'fixtures',
      testMatch: /\.fixtures\.spec\.ts$/,
    },
    {
      // The real sites: catches markup changes. Needs network; can be slow.
      name: 'live',
      testMatch: /\.live\.spec\.ts$/,
      timeout: 120_000,
      retries: 1,
      workers: 2,
    },
  ],
});
