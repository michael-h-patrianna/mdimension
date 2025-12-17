import { test, expect } from '@playwright/test';

test('capture temporal debug logs', async ({ page }) => {
  // Capture console logs
  page.on('console', msg => {
    if (msg.text().includes('[TR-DEBUG]')) {
      console.log(msg.text());
    }
  });

  console.log('Navigating to app...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' }); // Vite configured port is 3000

  // Wait for the canvas to appear - try longer timeout
  try {
    await page.waitForSelector('canvas', { timeout: 30000 });
  } catch (e) {
    console.log('Canvas not found, but continuing...');
  }

  // Wait for a few seconds to capture logs
  console.log('Waiting for logs...');
  await page.waitForTimeout(5000); // 5 seconds

  // Take a screenshot for visual confirmation (Gate 3)
  await page.screenshot({ path: 'screenshots/temporal-debug-visual.png' });
  console.log('Screenshot saved to screenshots/temporal-debug-visual.png');

  // Also save to debug-observation for backwards compatibility
  await page.screenshot({ path: 'screenshots/debug-observation.png' });
  console.log('Screenshot saved to screenshots/debug-observation.png');
});