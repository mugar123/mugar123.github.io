import { defineConfig, devices } from '@playwright/test';

// Port 4322, not Astro's default 4321: a running `astro dev` on 4321 would otherwise be reused
// (reuseExistingServer) and the suite would test the dev server instead of the built site.
// --ignore-lock: `astro preview` refuses to start (and exits at once) while another preview server
// holds its lock file, e.g. one started with `astro preview --background`.
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  webServer: { command: 'npm run preview -- --port 4322 --ignore-lock', url: 'http://localhost:4322', reuseExistingServer: !process.env.CI },
  use: { baseURL: 'http://localhost:4322' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
    { name: 'no-js', use: { ...devices['Desktop Chrome'], javaScriptEnabled: false } },
  ],
});
