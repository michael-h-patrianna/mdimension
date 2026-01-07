import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './scripts/playwright',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'line',
  use: {
    baseURL: 'https://localhost:3004',
    trace: 'on-first-retry',
    ignoreHTTPSErrors: true,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chrome', // Use Chrome instead of Chromium for better WebGPU support
        headless: false, // WebGPU requires headed mode on macOS
        // Enable WebGPU in Chrome
        launchOptions: {
          executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
          args: [
            '--enable-unsafe-webgpu',
            '--enable-features=Vulkan,UseSkiaRenderer,WebGPU',
            '--enable-dawn-features=allow_unsafe_apis',
          ],
        },
      },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'https://localhost:3004',
    reuseExistingServer: !process.env.CI,
    stdout: 'ignore',
    stderr: 'pipe',
    ignoreHTTPSErrors: true,
  },
});
