import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './test/browser',
  fullyParallel: true,
  use: {
    baseURL: 'http://127.0.0.1:5187',
    launchOptions: process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {},
  },
  webServer: {
    command: 'node test/server.mjs',
    url: 'http://127.0.0.1:5187',
    reuseExistingServer: false,
  },
});
