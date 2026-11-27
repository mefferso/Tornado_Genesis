import { defineConfig } from '@playwright/test';

const baseURL = process.env.LAB_TEST_URL ?? 'http://127.0.0.1:4173/Tornado_Genesis/';
export default defineConfig({
  testDir: './tests',
  testMatch: '*.spec.js',
  timeout: 65000,
  expect: { timeout: 9500 },
  workers: 1,
  use: {
    baseURL,
    viewport: { width: 1240, height: 810 },
    launchOptions: {
      executablePath: process.env.LAB_CHROMIUM,
      args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
    },
  },
  webServer: process.env.LAB_TEST_URL ? undefined : {
    command: 'npm run preview -- --host 127.0.0.1 --port 4173 --strictPort',
    url: baseURL, reuseExistingServer: !process.env.CI,
  },
});
